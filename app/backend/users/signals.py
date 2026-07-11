"""
Аудит аутентификации: входы, выходы и неудачные попытки — в отдельный лог
(logger 'audit' → SHARED_DIR/logs/audit.log, см. LOGGING в settings.py).
"""
import logging

from django.contrib.auth.signals import user_logged_in, user_logged_out, user_login_failed
from django.dispatch import receiver

audit_logger = logging.getLogger('audit')


def _client_ip(request):
    """IP клиента: за nginx настоящий адрес — в X-Forwarded-For (первый в цепочке)."""
    if request is None:
        return '-'
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '-')


@receiver(user_logged_in)
def log_user_logged_in(sender, request, user, **kwargs):
    audit_logger.info("login user=%s id=%s ip=%s", user.get_username(), user.pk, _client_ip(request))


@receiver(user_logged_out)
def log_user_logged_out(sender, request, user, **kwargs):
    username = user.get_username() if user else '-'
    user_id = user.pk if user else '-'
    audit_logger.info("logout user=%s id=%s ip=%s", username, user_id, _client_ip(request))


@receiver(user_login_failed)
def log_user_login_failed(sender, credentials, request, **kwargs):
    audit_logger.warning(
        "login_failed username=%s ip=%s", credentials.get('username', '-'), _client_ip(request)
    )
