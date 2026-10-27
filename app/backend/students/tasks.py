"""
Периодические задачи приложения students.
"""
import logging

from celery import shared_task
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def auto_rollover_semester():
    """
    НЕ ЗАДЕЙСТВОВАНО: переход выполняется вручную из админки (решение 2026-10-20), запись в
    CELERY_BEAT_SCHEDULE закомментирована.

    Автоматический ролловер: если у текущего семестра истёк end_date и есть следующий
    период — завершает текущий и активирует следующий. Идемпотентна: пока семестр не
    закончился или следующего нет, ничего не делает.
    """
    from university_structure.models import AcademicYear
    from students.services import rollover_semester

    current = AcademicYear.get_current()
    if current is None:
        return "no current semester"

    today = timezone.localdate()
    if current.end_date >= today:
        return f"current semester '{current.label}' not ended yet (ends {current.end_date})"

    next_sem = (
        AcademicYear.objects.filter(start_date__gt=current.start_date)
        .order_by('start_date').first()
    )
    if next_sem is None:
        return "no next semester configured"

    result = rollover_semester(to_semester=next_sem)
    return f"rolled over: {result}"


@shared_task(
    name="students.tasks.send_review_decision_email",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
)
def send_review_decision_email(self, document_id: int, status_code: str):
    """
    Письмо студенту о решении по его заявке. Заявка и настройки перечитываются здесь:
    пока задача ждала, решение могли сменить (о новом уйдёт своё письмо), студент мог
    отключить письма или уйти в архив.
    """
    from students.models import Document
    from users.services import is_active_student, send_review_decision_notice_email

    document = Document.objects.select_related('status', 'user__student_profile').filter(pk=document_id).first()
    if document is None or document.status.code != status_code:
        logger.info("decision email skipped: doc id=%s deleted or decision changed", document_id)
        return
    user = document.user
    if not (user.notify_review_emails and user.email and is_active_student(user)):
        logger.info("decision email skipped: doc id=%s, user id=%s opted out or inactive", document_id, user.pk)
        return
    # dev-база - копия реальных студентов: при DEBUG письма уходят только test_*-учёткам.
    if settings.DEBUG and not user.username.startswith('test_'):
        logger.warning("decision email skipped (DEBUG): user id=%s is not a test account", user.pk)
        return
    try:
        send_review_decision_notice_email(user.email, user.get_user_display_name(), document)
        logger.info("decision email sent: doc id=%s user id=%s", document_id, user.pk)
    except Exception as exc:
        # Только тип ошибки: текст SMTP-ошибки содержит адрес студента.
        logger.warning("decision email failed: doc id=%s: %s", document_id, type(exc).__name__)
        raise self.retry(exc=exc)
