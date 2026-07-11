from django.apps import AppConfig


class UsersConfig(AppConfig):
    name = 'users'
    verbose_name = "Пользователи"

    def ready(self):
        # Аудит входов/выходов/неудачных попыток (logger 'audit').
        from . import signals  # noqa: F401
