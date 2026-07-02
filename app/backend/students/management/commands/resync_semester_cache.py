"""
Пересобрать живой кэш баллов студентов из истории текущего семестра.

Разовая починка данных, рассинхронизированных ручной сменой текущего семестра до появления
автосинхронизации (сигнала). Идемпотентна.

    python manage.py resync_semester_cache
"""
from django.core.management.base import BaseCommand

from students.services import rebuild_current_semester_cache
from university_structure.models import AcademicYear


class Command(BaseCommand):
    help = "Пересобирает живой кэш баллов Student из SemesterScore текущего семестра."

    def handle(self, *args, **options):
        current = AcademicYear.get_current()
        updated = rebuild_current_semester_cache()
        self.stdout.write(self.style.SUCCESS(
            f"Готово. Текущий семестр: {current or '—'}; обновлено записей студентов: {updated}."
        ))
