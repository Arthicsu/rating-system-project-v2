from django.apps import AppConfig


class StudentsConfig(AppConfig):
    name = 'students'
    verbose_name = "Студенты"

    def ready(self):
        # Подключаем сигналы синхронизации кэша баллов при смене текущего семестра.
        from . import signals  # noqa: F401
