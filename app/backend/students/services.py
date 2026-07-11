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

from core.exceptions import InvalidDocumentState
from university_structure.models import AcademicYear
from students.models import Document, DocumentFile, DocumentStatus, Student, SemesterScore
from students.scoring import calculate_achievement_score

logger = logging.getLogger(__name__)
# Решения по заявкам — в аудит-лог (SHARED_DIR/logs/audit.log, см. LOGGING).
audit_logger = logging.getLogger('audit')


CATEGORY_SCORE_FIELDS = (
    'academic_score', 'research_score', 'sport_score', 'social_score', 'cultural_score',
)

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

    Балл считается по ScoringRule; заявка привязывается к текущему семестру
    и уходит на рассмотрение (статус 'pending'). Вызывается из
    AchievementUploadSerializer.create().
    """
    status_obj = DocumentStatus.objects.get(code='pending')

    score = calculate_achievement_score(
        validated['category'].code,
        validated['sub_type'].code,
        validated.get('level').code if validated.get('level') else None,
        validated.get('result').code if validated.get('result') else None,
    )

    with transaction.atomic():
        document = Document.objects.create(
            user=user,
            status=status_obj,
            score=score,
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


def update_achievement(document, validated_data, files=None):
    """
    Частичное обновление заявки студентом.

    Отклонённая заявка после правок возвращается на повторное рассмотрение.
    Если переданы файлы — старые заменяются, а из хранилища удаляются только
    после коммита транзакции. Вызывается из AchievementUpdateSerializer.update().
    """
    for attr, value in validated_data.items():
        setattr(document, attr, value)

    # Повторная подача: отклонённая заявка снова уходит на рассмотрение.
    if document.status.code == 'rejected':
        document.status = DocumentStatus.objects.get(code='pending')
        document.rejection_reason = ''

    with transaction.atomic():
        document.save()  # балл пересчитывается в Document.save()

        if files is not None:
            old_files = list(document.files.all())
            document.files.all().delete()

            for order, file in enumerate(files):
                DocumentFile.objects.create(
                    document=document,
                    file=file,
                    original_file_name=file.name,
                    order=order,
                )

            def _cleanup_old_files(files_to_remove=old_files):
                for old_file in files_to_remove:
                    try:
                        old_file.file.delete(save=False)
                    except Exception:
                        logger.exception("Не удалось удалить старый файл достижения из хранилища")

            transaction.on_commit(_cleanup_old_files)

    return document


@transaction.atomic
def review_document(*, document, reviewer, action, reasons=()):
    """
    Модерация заявки сотрудником. Возвращает текст сообщения для ответа.

    Правила:
    - кафедра обрабатывает только новые заявки (pending): approve — начисляет
      баллы (credit_document), reject — отклоняет с причинами;
    - декан/ректорат могут только отклонить: с approved списываются баллы
      (debit_document), заявка возвращается на рассмотрение (pending).

    Проверка области видимости — забота permission-класса CanReviewDocument.
    При нарушении правил статусов поднимает InvalidDocumentState (HTTP 400).
    """
    reason_text = "; ".join(reasons) if isinstance(reasons, (list, tuple)) else str(reasons)

    if reviewer.is_dept_staff:
        if document.status.code != 'pending':
            raise InvalidDocumentState("Кафедра может обрабатывать только новые заявки (pending)")

        if action == 'approve':
            document.status = DocumentStatus.objects.get(code='approved')
            document.rejection_reason = ''
            document.verified_by = reviewer
            document.save()

            # Баллы начисляются в семестр заявки (текущий — так же обновит кэш Student).
            credit_document(document)
            audit_logger.info(
                "review doc=%s reviewer=%s action=approve result=approved score=%s",
                document.id, reviewer.pk, document.score,
            )
            return "Документ подтвержден кафедрой, баллы начислены"

        document.status = DocumentStatus.objects.get(code='rejected')
        document.rejection_reason = reason_text
        document.verified_by = reviewer
        document.save()
        audit_logger.info(
            "review doc=%s reviewer=%s action=reject result=rejected reasons=%s",
            document.id, reviewer.pk, reason_text,
        )
        return "Документ отклонен кафедрой"

    if reviewer.is_dean or reviewer.is_rectorate:
        if action != 'reject':
            raise InvalidDocumentState("Руководство может только отклонять заявки")

        if document.status.code == 'approved':
            # Списываем баллы из семестра заявки (текущий — так же обновит кэш Student).
            debit_document(document)

        document.status = DocumentStatus.objects.get(code='pending')
        document.rejection_reason = reason_text
        document.verified_by = reviewer
        document.save()
        audit_logger.info(
            "review doc=%s reviewer=%s action=reject result=returned_to_pending reasons=%s",
            document.id, reviewer.pk, reason_text,
        )
        return "Решение отменено руководством. Заявка возвращена на рассмотрение, баллы вычтены."

    raise InvalidDocumentState("Неизвестная ошибка")


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
