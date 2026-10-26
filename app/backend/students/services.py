"""
Сервисный слой учёта баллов в разрезе семестра.

Единственный источник изменения баллов: заявка (Document) начисляет/списывает баллы в
строку SemesterScore своего семестра. Если это текущий семестр — синхронно обновляется
денормализованный кэш на Student (по нему строится «живой» рейтинг и индекс -total_score).

Инвариант: живые поля баллов на Student == SemesterScore(текущий семестр) (или 0). Он
поддерживается при начислении/списании и пересобирается при ЛЮБОЙ смене текущего семестра —
через сигнал на AcademicYear (см. students/signals.py), который зовёт
rebuild_current_semester_cache().
"""
import logging
import threading
from contextlib import contextmanager

from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from core.cache_utils import invalidate_view_cache
from core.exceptions import InvalidDocumentState
from core.students_manager import CATEGORY_SCORE_FIELDS
from university_structure.models import AcademicYear
from students.models import Document, DocumentFile, DocumentStatus, Student, SemesterScore

logger = logging.getLogger(__name__)
# Решения по заявкам — в аудит-лог (SHARED_DIR/logs/audit.log, см. LOGGING).
audit_logger = logging.getLogger('audit')

# Подавление автосинхронизации кэша (используется во время rollover_semester, который
# сам пересобирает кэш один раз в конце — чтобы сигнал не делал это на каждом save()).
_sync_state = threading.local()


def is_cache_sync_suspended():
    return getattr(_sync_state, 'suspended', False)


@contextmanager
def suspend_cache_sync():
    prev = getattr(_sync_state, 'suspended', False)
    _sync_state.suspended = True
    try:
        yield
    finally:
        _sync_state.suspended = prev


def _score_field(category_code):
    return f"{category_code}_score"


def apply_score_delta(student, semester, category_code, delta):
    """
    Изменить баллы студента за указанный семестр на delta (может быть отрицательным).

    Обновляет строку SemesterScore(student, semester); если semester — текущий, синхронно
    правит и кэш на Student. Значения не опускаются ниже нуля. Вызывать внутри транзакции.
    """
    field = _score_field(category_code)

    ss, _ = SemesterScore.objects.select_for_update().get_or_create(student=student, semester=semester)
    if not hasattr(ss, field):
        return
    setattr(ss, field, max(0, getattr(ss, field) + delta))
    ss.save(update_fields=[field])

    current = AcademicYear.get_current()
    if current is not None and semester.pk == current.pk and hasattr(student, field):
        setattr(student, field, max(0, getattr(student, field) + delta))
        student.save(update_fields=[field])

    # Баллы изменились — страницы рейтинга (cache_page) устарели. Сброс после
    # коммита, чтобы параллельный запрос не закэшировал старые данные заново.
    transaction.on_commit(lambda: invalidate_view_cache('rating-list'))


def _resolve_semester(doc):
    """Семестр заявки, либо текущий (для legacy-заявок без привязки)."""
    return doc.semester or AcademicYear.get_current()


def credit_document(doc):
    """Начислить баллы заявки в её семестр (при одобрении)."""
    student = getattr(doc.user, 'student_profile', None)
    semester = _resolve_semester(doc)
    if student is None or semester is None:
        return
    apply_score_delta(student, semester, doc.category.code, doc.score)


def debit_document(doc):
    """Списать баллы заявки из её семестра (при отмене одобрения)."""
    student = getattr(doc.user, 'student_profile', None)
    semester = _resolve_semester(doc)
    if student is None or semester is None:
        return
    apply_score_delta(student, semester, doc.category.code, -doc.score)


def create_achievement(*, user, files, **validated):
    """
    Создать заявку (Document) с файлами.

    Балл считается по ScoringRule в Document.save(); заявка привязывается
    к текущему семестру и уходит на рассмотрение (статус 'pending').
    Вызывается из AchievementUploadSerializer.create().
    """
    status_obj = DocumentStatus.objects.get(code='pending')

    with transaction.atomic():
        document = Document.objects.create(
            user=user,
            status=status_obj,
            semester=AcademicYear.get_current(),
            **validated,
        )

        for order, file in enumerate(files):
            DocumentFile.objects.create(
                document=document,
                file=file,
                original_file_name=file.name,
                order=order,
            )

    return document


def check_file_limits(document, remove_file_ids, new_files):
    """
    Состав файлов после правки: удаляются только файлы этой заявки, итог 1..MAX_FILES и не
    больше MAX_TOTAL_SIZE. Сериализатор вызывает для быстрого ответа, update_achievement —
    ещё раз под блокировкой строки: параллельные PATCH валидировались по одному старому
    состоянию и вместе обошли бы лимиты (или оставили заявку без файлов).
    """
    from .serializers import MAX_FILES, MAX_TOTAL_SIZE, stored_size

    if not new_files and not remove_file_ids:
        return  # файлы не меняются: старые заявки без файлов правят текст
    current = {f.id: f for f in document.files.all()}
    remove_ids = set(remove_file_ids)
    if remove_ids - current.keys():
        raise ValidationError({"remove_file_ids": "Можно удалить только файлы этой заявки."})
    kept = [f for file_id, f in current.items() if file_id not in remove_ids]
    if not 1 <= len(kept) + len(new_files) <= MAX_FILES:
        raise ValidationError({"files": f"Оставьте или добавьте от 1 до {MAX_FILES} файлов."})
    try:
        kept_size = sum(stored_size(f) for f in kept)
    except Exception:
        logger.exception("Не удалось узнать размер файлов заявки %s", document.pk)
        raise ValidationError({"files": "Не удалось проверить размер файлов заявки, попробуйте позже."})
    if kept_size + sum(f.size for f in new_files) > MAX_TOTAL_SIZE:
        raise ValidationError({"files": "Суммарный размер файлов не должен превышать 20 МБ."})


def update_achievement(document, validated_data, files=None, remove_file_ids=()):
    """
    Частичное обновление заявки студентом.

    Отклонённая заявка после правок возвращается на повторное рассмотрение.
    remove_file_ids — удалить эти файлы заявки, files — добавить к оставшимся (порядок
    заново 0..n-1); из хранилища удалённые стираются только после коммита транзакции.
    Проверки состава файлов — в AchievementUpdateSerializer.validate().
    """
    with transaction.atomic():
        # Статус и решение — из БД под блокировкой строки: модератор мог решить, пока студент
        # правил заявку, и правка вернула бы в pending уже одобренную, с начисленными баллами.
        locked = Document.objects.select_for_update().get(pk=document.pk)
        if locked.status.code == 'approved':
            raise PermissionDenied("Нельзя редактировать подтверждённое достижение.")
        document.status = locked.status
        document.verified_by_id = locked.verified_by_id
        document.rejection_reason = locked.rejection_reason
        check_file_limits(document, remove_file_ids, files or [])

        for attr, value in validated_data.items():
            setattr(document, attr, value)

        # Повторная подача: отклонённая заявка снова уходит на рассмотрение. Причину не
        # стираем - по ней кафедра видит, что заявку уже отклоняли и за что; очищается при одобрении.
        if document.status.code == 'rejected':
            document.status = DocumentStatus.objects.get(code='pending')
            # Теперь это повторная подача студента, а не возврат руководством: verified_by
            # руководителя дал бы метку «Возвращена деканатом» (кто отклонил — в аудит-логе).
            document.verified_by = None

        document.save()  # балл пересчитывается в Document.save()

        removed = list(document.files.filter(id__in=remove_file_ids))
        if removed:
            DocumentFile.objects.filter(id__in=[f.id for f in removed]).delete()
            transaction.on_commit(lambda: _delete_stored_files(removed))

        if files or removed:
            kept = list(document.files.order_by('order', 'id'))
            for order, kept_file in enumerate(kept):
                if kept_file.order != order:
                    kept_file.order = order
                    kept_file.save(update_fields=['order'])
            for order, file in enumerate(files or (), start=len(kept)):
                DocumentFile.objects.create(
                    document=document,
                    file=file,
                    original_file_name=file.name,
                    order=order,
                )

    return document


def delete_achievement(document):
    """
    Удаление заявки студентом. Подтверждённую удалить нельзя — баллы уже начислены; статус
    проверяется под блокировкой строки (модератор мог одобрить, пока студент удалял).
    Файлы из хранилища удаляются только после коммита.
    """
    with transaction.atomic():
        document = Document.objects.select_for_update().get(pk=document.pk)
        if document.status.code == 'approved':
            raise PermissionDenied("Нельзя удалить подтверждённое достижение.")

        files = list(document.files.all())
        document.delete()
        transaction.on_commit(lambda: _delete_stored_files(files))


def _delete_stored_files(document_files):
    for document_file in document_files:
        try:
            document_file.file.delete(save=False)
        except Exception:
            logger.exception("Не удалось удалить файл достижения из хранилища")


# Вариант А (спек 2д): кафедра решает, руководство контролирует.
# (роль, действие) -> {исходный статус: новый статус}; чего нет в таблице — запрещено (400).
_REVIEW_RULES = {
    ('department', 'approve'): {'pending': 'approved', 'rejected': 'approved'},
    ('department', 'reject'): {'pending': 'rejected', 'approved': 'rejected'},
    ('leadership', 'reject'): {'approved': 'rejected'},
    ('leadership', 'return'): {'approved': 'pending', 'rejected': 'pending'},
}
_ACTION_VERBS = {'approve': 'одобрить', 'reject': 'отклонить', 'return': 'вернуть кафедре'}
# Слова кабинета сотрудника (метка статуса в БД — «Подтверждено» — для студента).
_STATUS_NAMES = {'pending': 'На рассмотрении', 'approved': 'Одобрена', 'rejected': 'Отклонена'}


@transaction.atomic
def review_document(*, document, reviewer, action, reasons=()):
    """
    Модерация заявки сотрудником по таблице _REVIEW_RULES. Возвращает текст сообщения для ответа.

    Одобрение начисляет баллы и очищает причину, уход из approved списывает баллы.
    Возврат кафедре — снова pending с причиной и verified_by руководителя: по нему кабинет
    кафедры ставит метку «Возвращена деканатом/ректоратом».

    Проверка области видимости — забота permission-класса CanReviewDocument.
    При нарушении правил поднимает InvalidDocumentState (HTTP 400).
    """
    if reviewer.is_leadership:
        role = 'leadership'
    elif reviewer.is_dept_staff:
        role = 'department'
    else:
        raise InvalidDocumentState("У сотрудника нет роли модератора")

    transitions = _REVIEW_RULES.get((role, action))
    if transitions is None:
        raise InvalidDocumentState(
            "Одобряет заявки кафедра; руководство может отклонить заявку или вернуть её кафедре"
            if role == 'leadership' else "Вернуть заявку кафедре может только деканат или ректорат"
        )

    # Статус — из БД под блокировкой строки: два модератора одновременно не спишут баллы дважды.
    document = Document.objects.select_for_update().get(pk=document.pk)
    old_code = document.status.code
    if old_code not in transitions:
        if role == 'leadership' and old_code == 'pending':
            raise InvalidDocumentState("Новую заявку сначала рассматривает кафедра")
        raise InvalidDocumentState(f"Нельзя {_ACTION_VERBS[action]} заявку в статусе «{_STATUS_NAMES[old_code]}»")
    new_code = transitions[old_code]

    # Баллы — в семестр заявки (текущий — так же обновит кэш Student). Списание до save():
    # save() пересчитывает балл, а списать нужно ровно начисленное.
    points = 0
    if old_code == 'approved':
        debit_document(document)
        points = -document.score

    reason_text = "; ".join(reasons) if isinstance(reasons, (list, tuple)) else str(reasons)
    document.status = DocumentStatus.objects.get(code=new_code)
    document.rejection_reason = '' if action == 'approve' else reason_text
    document.verified_by = reviewer
    document.save()

    if new_code == 'approved':
        credit_document(document)
        points = document.score

    audit_logger.info(
        "review doc=%s reviewer=%s action=%s from=%s to=%s points=%+d reasons=%s",
        document.id, reviewer.pk, action, old_code, new_code, points, reason_text,
    )

    if action == 'approve':
        return "Заявка одобрена, баллы начислены"
    debited = ", баллы списаны" if old_code == 'approved' else ""
    if action == 'reject':
        return f"Заявка отклонена{debited}. Студент увидит причину и сможет исправить заявку"
    return f"Заявка возвращена кафедре на повторное рассмотрение{debited}"


@transaction.atomic
def rebuild_current_semester_cache():
    """
    Пересобрать живой кэш баллов всех студентов из SemesterScore ТЕКУЩЕГО семестра.

    Для каждого студента живые поля становятся равны его строке SemesterScore текущего
    семестра, либо 0 — если строки нет / нет текущего семестра. Так «переключение» текущего
    семестра (любым способом: rollover, ручное изменение is_current в админке) не даёт баллам
    наслаиваться, а возврат на прошлый семестр восстанавливает его значения.

    Возвращает число обновлённых записей Student.
    """
    zeros = {f: 0 for f in CATEGORY_SCORE_FIELDS}
    current = AcademicYear.get_current()
    if current is None:
        return Student.objects.update(**zeros)

    rows = list(
        SemesterScore.objects.filter(semester=current).values('student_id', *CATEGORY_SCORE_FIELDS)
    )
    row_ids = [r['student_id'] for r in rows]

    # Студентам без строки за текущий семестр — нули.
    updated = Student.objects.exclude(id__in=row_ids).update(**zeros)
    # Студентам со строкой — значения строки.
    for r in rows:
        updated += Student.objects.filter(id=r['student_id']).update(
            **{f: r[f] for f in CATEGORY_SCORE_FIELDS}
        )
    return updated


@transaction.atomic
def rollover_semester(to_semester=None):
    """
    Завершить текущий семестр и активировать следующий.

    1. (страховка) синхронизировать строки SemesterScore текущего семестра с живыми полями
       студентов, у которых есть баллы;
    2. снять is_current с текущего семестра и поставить на `to_semester` (или на ближайший по
       start_date, если не задан);
    3. пересобрать живой кэш из SemesterScore нового текущего семестра (для нового семестра — нули).

    Переключения is_current делаются с подавлением автосинхронизации, а кэш пересобирается один
    раз в конце. Возвращает словарь со статистикой.
    """
    current = AcademicYear.get_current()
    result = {'archived': None, 'activated': None, 'students_reset': 0, 'snapshots': 0}

    with suspend_cache_sync():
        if current is not None:
            # Страховка от рассинхрона: строки текущего семестра должны совпадать с кэшем Student.
            # Архивных студентов НЕ исключаем намеренно: если студента заархивировали в середине
            # семестра (отчислен/окончил), его заработанные баллы всё равно фиксируются в истории
            # этого семестра. Живой кэш затем пересобирается для всех (архивные и так скрыты из рейтинга).
            snapshots = 0
            for student in Student.objects.filter(total_score__gt=0).iterator():
                SemesterScore.objects.update_or_create(
                    student=student, semester=current,
                    defaults={
                        'academic_score': student.academic_score,
                        'research_score': student.research_score,
                        'sport_score': student.sport_score,
                        'social_score': student.social_score,
                        'cultural_score': student.cultural_score,
                    },
                )
                snapshots += 1
            result['snapshots'] = snapshots
            result['archived'] = current.label

            current.is_current = False
            current.save(update_fields=['is_current'])

        # Выбираем следующий семестр.
        if to_semester is None and current is not None:
            to_semester = (
                AcademicYear.objects.filter(start_date__gt=current.start_date)
                .order_by('start_date').first()
            )

        if to_semester is not None:
            # Гарантируем единственность текущего перед активацией.
            AcademicYear.objects.filter(is_current=True).update(is_current=False)
            to_semester.is_current = True
            to_semester.save(update_fields=['is_current'])
            result['activated'] = to_semester.label

    # Живые поля приводим к новому текущему семестру (для свежего семестра — нули).
    result['students_reset'] = rebuild_current_semester_cache()
    return result
