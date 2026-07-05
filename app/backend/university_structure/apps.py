from django.apps import AppConfig


class UniversityStructureConfig(AppConfig):
    name = 'university_structure'
    verbose_name = "Структура университета"

    def ready(self):
        # Сигналы инвалидации кэшей справочников.
        from . import signals  # noqa: F401
