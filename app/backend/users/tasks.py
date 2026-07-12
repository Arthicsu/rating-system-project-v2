"""
Celery-задачи приложения users.
Восстановление пароля целиком выполняется в задаче: HTTP-запрос не ждёт SMTP,
а в брокер (Redis) уходит только id пользователя. Раньше вьюха генерировала
пароль сама и передавала его сюда открытым текстом -
он лежал в очереди (и в аргументах ретраев) до момента отправки письма.
"""
import logging

from celery import shared_task
from django.contrib.auth import get_user_model

from .services import reset_user_password, send_password_email

logger = logging.getLogger(__name__)


@shared_task(
    name="users.tasks.send_recovery_password_email",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
)
def send_recovery_password_email(self, user_id: int):
    """
    Генерирует пользователю новый временный пароль и отправляет его на почту.
    Каждый ретрай генерирует пароль заново, так что действителен тот,
    который ушёл в последнем успешном письме.
    """
    user = get_user_model().objects.filter(pk=user_id).first()
    if user is None:
        # Пользователя могли удалить, пока задача ждала в очереди
        logger.warning("recovery email skipped: user id=%s not found", user_id)
        return

    try:
        user_name = user.get_user_display_name()
    except Exception as exc:
        logger.warning("Не удалось получить отображаемое имя пользователя: %s", exc)
        user_name = "Пользователь"

    new_password = reset_user_password(user)
    try:
        send_password_email(user.email, user_name, new_password)
        logger.info("recovery password email sent to user id=%s", user_id)
    except Exception as exc:
        logger.warning("recovery password email failed for user id=%s: %s", user_id, exc)
        raise self.retry(exc=exc)
