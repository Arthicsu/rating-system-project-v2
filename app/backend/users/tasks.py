"""
Celery-задачи приложения users.
Отправка письма с новым паролем при восстановлении вынесена сюда, чтобы HTTP-запрос
не ждал ответа SMTP-сервера.
Пароль уже сгенерирован и сохранён во вьюхе, в задачу передаётся только готовый открытый текст, поэтому ретраи не порождают новый пароль
"""
import logging

from celery import shared_task

from .services import send_password_email

logger = logging.getLogger(__name__)


@shared_task(
    name="users.tasks.send_recovery_password_email",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
)
def send_recovery_password_email(self, email: str, user_name: str, new_password: str):
    """Отправляет письмо с новым временным паролем; при ошибке SMTP повторяет до 3 раз."""
    try:
        send_password_email(email, user_name, new_password)
        logger.info("recovery password email sent to %s", email)
    except Exception as exc:
        logger.warning("recovery password email failed for %s: %s", email, exc)
        raise self.retry(exc=exc)
