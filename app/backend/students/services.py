"""
Сервисный слой учёта баллов в разрезе семестра.

Единственный источник изменения баллов: заявка (Document) начисляет/списывает баллы в
строку SemesterScore своего семестра. Если семестр из текущего учебного года — синхронно
обновляется денормализованный кэш на Student (по нему строится «живой» рейтинг и индекс
-total_score).

Инвариант: живые поля баллов на Student == сумма SemesterScore по семестрам текущего
учебного года (или 0). Он поддерживается при начислении/списании и пересобирается при ЛЮБОЙ
смене текущего семестра — через сигнал на AcademicYear (см. students/signals.py), который
зовёт rebuild_current_semester_cache().
"""
import logging
import threading
from contextlib import contextmanager
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from core.cache_utils import invalidate_view_cache
from core.exceptions import InvalidDocumentState
from core.students_manager import CATEGORY_SCORE_FIELDS
from university_structure.models import AcademicYear
from students.models import Document, DocumentFile, DocumentStatus, Student, SemesterScore
from students.tasks import send_review_decision_email

User = get_user_model()
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

    Обновляет строку SemesterScore(student, semester); если семестр из текущего учебного года,
    синхронно правит и кэш на Student. Значения не опускаются ниже нуля. Вызывать внутри транзакции.
    """
    field = _score_field(category_code)

    ss, _ = SemesterScore.objects.select_for_update().get_or_create(student=student, semester=semester)
    if not hasattr(ss, field):
        return
    setattr(ss, field, max(0, getattr(ss, field) + delta))
    ss.save(update_fields=[field])

    current = AcademicYear.get_current()
    if current is not None and semester.year_start == current.year_start and hasattr(student, field):
        # Сумма строк года, а не += delta: обрезка до нуля в строке и в сумме разошлась бы.
        total = SemesterScore.objects.filter(
            student=student, semester__year_start=current.year_start,
        ).aggregate(total=Sum(field))['total'] or 0
        setattr(student, field, total)
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


def semester_for_achievement_date(day):
    """
    Семестр заявки по дате достижения (AcademicYear.semester_for_date). Дата в будущем и дата,
    для которой в портфолио нет семестра, - ошибка 400: спорные случаи разбирает сотрудник.
    """
    if day > timezone.localdate():
        raise ValidationError({'date_received': "Дата получения не может быть в будущем."})
    semester = AcademicYear.semester_for_date(day)
    if semester is None:
        raise ValidationError({'date_received': (
            f"Для даты {day:%d.%m.%Y} в портфолио нет учебного семестра. Проверьте дату получения; "
            f"если она верна, обратитесь на кафедру."
        )})
    return semester


def create_achievement(*, user, files, **validated):
    """
    Создать заявку (Document) с файлами.

    Балл считается по ScoringRule в Document.save(); заявка привязывается к семестру по дате
    достижения (без даты - сегодняшней) и уходит на рассмотрение (статус 'pending').
    Вызывается из AchievementUploadSerializer.create().
    """
    validated.setdefault('date_received', timezone.localdate())
    semester = semester_for_achievement_date(validated['date_received'])
    status_obj = DocumentStatus.objects.get(code='pending')

    with transaction.atomic():
        document = Document.objects.create(
            user=user,
            status=status_obj,
            semester=semester,
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

    Отклонённая заявка после правок возвращается на повторное рассмотрение, смена даты
    достижения переносит заявку в семестр новой даты. remove_file_ids — удалить эти файлы заявки, files — добавить к оставшимся (порядок
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
        if 'date_received' in validated_data:
            document.semester = semester_for_achievement_date(validated_data['date_received'])

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


def purge_candidates(now=None):
    """Файлы заявок студентов, которые в архиве дольше ARCHIVED_FILES_RETENTION_DAYS."""
    cutoff = (now or timezone.now()) - timedelta(days=settings.ARCHIVED_FILES_RETENTION_DAYS)
    return DocumentFile.objects.filter(
        document__user__student_profile__archived_at__lt=cutoff,
    ).select_related('document')


def _stored_bytes(document_file):
    try:
        return document_file.file.size
    except Exception:
        logger.warning("Не удалось узнать размер файла достижения id=%s", document_file.pk)
        return 0


def purge_summary(files):
    """
    Сводка для страницы подтверждения: студенты, заявки, файлы, байты.
    shortcut: размер - запрос к хранилищу на каждый файл; если файлов станут тысячи и
    страница начнёт тормозить - хранить размер в DocumentFile при загрузке.
    """
    files = list(files)
    return {
        'students': len({f.document.user_id for f in files}),
        'documents': len({f.document_id for f in files}),
        'files': len(files),
        'bytes': sum(_stored_bytes(f) for f in files),
    }


def purge_archived_files(actor, now=None):
    """
    Удалить файлы заявок студентов, архивных дольше срока хранения: строки DocumentFile
    сразу, объекты в хранилище - после коммита; заявкам ставится files_purged_at.
    Заявки, баллы и история остаются. Возвращает сводку (как purge_summary).
    """
    now = now or timezone.now()
    with transaction.atomic():
        removed = list(purge_candidates(now))
        summary = purge_summary(removed)
        Document.objects.filter(pk__in={f.document_id for f in removed}).update(files_purged_at=now)
        DocumentFile.objects.filter(pk__in=[f.pk for f in removed]).delete()
        transaction.on_commit(lambda: _delete_stored_files(removed))
    audit_logger.info(
        "purge archived files by=%s students=%s documents=%s files=%s bytes=%s retention_days=%s",
        actor.pk, summary['students'], summary['documents'], summary['files'], summary['bytes'],
        settings.ARCHIVED_FILES_RETENTION_DAYS,
    )
    return summary


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


def _queue_decision_email(document_id, status_code):
    # Решение уже сохранено: сбой очереди писем не должен превращаться в 500.
    try:
        send_review_decision_email.delay(document_id, status_code)
    except Exception:
        logger.exception("review: cannot queue decision email for doc id=%s", document_id)


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
    doc_id = document.id
    transaction.on_commit(lambda: _queue_decision_email(doc_id, new_code))

    if action == 'approve':
        return "Заявка одобрена, баллы начислены"
    debited = ", баллы списаны" if old_code == 'approved' else ""
    if action == 'reject':
        return f"Заявка отклонена{debited}. Студент увидит причину и сможет исправить заявку"
    return f"Заявка возвращена кафедре на повторное рассмотрение{debited}"


@transaction.atomic
def rebuild_current_semester_cache():
    """
    Пересобрать живой кэш баллов всех студентов из SemesterScore ТЕКУЩЕГО учебного года.

    Для каждого студента живые поля становятся равны сумме его строк SemesterScore за семестры
    текущего учебного года, либо 0 — если строк нет / нет текущего семестра. Переключение
    осень → весна внутри года баллы не меняет; переход на другой год (любым способом: переход в
    админке, ручное изменение is_current) не даёт баллам наслаиваться, а возврат на прошлый год
    восстанавливает его значения.

    Возвращает число обновлённых записей Student.
    """
    zeros = {f: 0 for f in CATEGORY_SCORE_FIELDS}
    current = AcademicYear.get_current()
    if current is None:
        return Student.objects.update(**zeros)

    rows = list(
        SemesterScore.objects.filter(semester__year_start=current.year_start)
        .order_by().values('student_id')
        .annotate(**{f'year_{f}': Sum(f) for f in CATEGORY_SCORE_FIELDS})
    )
    row_ids = [r['student_id'] for r in rows]

    # Студентам без строк за текущий год — нули.
    updated = Student.objects.exclude(id__in=row_ids).update(**zeros)
    # Студентам со строками — суммы за год.
    for r in rows:
        updated += Student.objects.filter(id=r['student_id']).update(
            **{f: r[f'year_{f}'] for f in CATEGORY_SCORE_FIELDS}
        )
    return updated


@transaction.atomic
def rollover_semester(to_semester=None):
    """
    Сделать текущим другой семестр: `to_semester` или ближайший следующий по start_date.

    Снимает is_current с текущего, ставит на новый и один раз в конце пересобирает живой кэш:
    внутри учебного года баллы сохраняются, при смене года живой рейтинг начинается с нуля.
    История (строки SemesterScore) не меняется - её пишут только начисление и списание заявок;
    кэш - сумма строк года, поэтому копировать его обратно в строку семестра нельзя.
    Переключения is_current делаются с подавлением автосинхронизации. Возвращает статистику.
    """
    current = AcademicYear.get_current()
    result = {'archived': None, 'activated': None, 'students_reset': 0}

    with suspend_cache_sync():
        if current is not None:
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


def _plain_student_users(student_ids):
    """
    Учётки студентов без прав сотрудника. Архивация студента не трогает вход сотрудника
    или администратора с тем же аккаунтом: иначе выпуск закрыл бы работнику кабинет, а
    возврат из архива включил бы учётку уволенного.
    """
    return User.objects.filter(
        student_profile__in=student_ids, staff_profile__isnull=True, is_staff=False, is_superuser=False,
    )


def archive_students(queryset, *, status=None, status_decoding=None, when=None):
    """
    Перевести студентов в архив и закрыть им вход: archived_at, итоговый код статуса (если
    задан; расшифровка - переданная или по STATUS_DECODINGS) и User.is_active=False. История
    баллов и файлы остаются, живые сессии гаснут сами: неактивный пользователь не проходит
    аутентификацию. Уже архивные не меняются. Возвращает число архивированных.
    """
    fields = {'archived_at': when or timezone.now()}
    if status is not None:
        fields['status'] = str(status)
        fields['status_decoding'] = Student.STATUS_DECODINGS.get(str(status), '')
    if status_decoding is not None:
        fields['status_decoding'] = status_decoding
    with transaction.atomic():
        ids = list(queryset.filter(archived_at__isnull=True).values_list('pk', flat=True))
        Student.objects.filter(pk__in=ids).update(**fields)
        _plain_student_users(ids).update(is_active=False)
    return len(ids)


def unarchive_students(queryset):
    """Вернуть студентов из архива и снова открыть им вход. Возвращает число возвращённых."""
    with transaction.atomic():
        ids = list(queryset.filter(archived_at__isnull=False).values_list('pk', flat=True))
        Student.objects.filter(pk__in=ids).update(archived_at=None)
        _plain_student_users(ids).update(is_active=True)
    return len(ids)
