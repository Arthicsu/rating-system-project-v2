"""
Ручной ролловер семестра.

Примеры:
    python manage.py rollover_semester            # активировать ближайший следующий по дате
    python manage.py rollover_semester --to 5     # активировать AcademicYear id=5
    python manage.py rollover_semester --dry-run  # показать план без изменений
"""
from django.core.management.base import BaseCommand, CommandError

from university_structure.models import AcademicYear
from students.services import rollover_semester


class Command(BaseCommand):
    help = "Завершает текущий семестр (обнуляет баллы, сохраняя историю) и активирует следующий."

    def add_arguments(self, parser):
        parser.add_argument('--to', type=int, default=None,
                            help="ID AcademicYear для активации (по умолчанию — ближайший следующий по start_date).")
        parser.add_argument('--dry-run', action='store_true',
                            help="Показать, что будет сделано, без изменений в БД.")

    def handle(self, *args, **options):
        current = AcademicYear.get_current()

        target = None
        if options['to'] is not None:
            try:
                target = AcademicYear.objects.get(id=options['to'])
            except AcademicYear.DoesNotExist:
                raise CommandError(f"AcademicYear id={options['to']} не найден.")

        if options['dry_run']:
            resolved = target
            if resolved is None and current is not None:
                resolved = (
                    AcademicYear.objects.filter(start_date__gt=current.start_date)
                    .order_by('start_date').first()
                )
            self.stdout.write(f"[dry-run] Текущий семестр: {current or '—'}")
            self.stdout.write(f"[dry-run] Будет активирован: {resolved or '—'}")
            self.stdout.write("[dry-run] Живые баллы студентов будут обнулены; история в SemesterScore сохранится.")
            return

        result = rollover_semester(to_semester=target)
        self.stdout.write(self.style.SUCCESS(
            f"Готово. Архивирован: {result['archived']}; активирован: {result['activated']}; "
            f"сброшено студентов: {result['students_reset']}; строк истории: {result['snapshots']}."
        ))
