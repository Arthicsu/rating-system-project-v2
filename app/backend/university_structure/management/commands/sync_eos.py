"""
Синхронизация данных из Api эоса.

Примеры:
    `python manage.py sync_eos` - всё (факультеты -> кафедры -> группы)
    `python manage.py sync_eos faculties`
    `python manage.py sync_eos departments`
    `python manage.py sync_eos groups`
    `python manage.py sync_eos students`
"""
from django.core.management.base import BaseCommand, CommandError

from core.eos import syncers


class Command(BaseCommand):
    help = "Синхронизация данных facultie's, department's, group's из публичного API ЭОС."

    def add_arguments(self, parser):
        parser.add_argument(
            "entity",
            nargs="?",
            default="all",
            choices=["all", "faculties", "departments", "groups", "students"],
        )

    def handle(self, *args, **options):
        entity = options["entity"]
        single = {
            "faculties": syncers.FacultySyncer,
            "departments": syncers.DepartmentSyncer,
            "groups": syncers.GroupSyncer,
            "students": syncers.StudentSyncer,
        }
        try:
            results = syncers.run_all() if entity == "all" else [single[entity]().run()]
        except Exception as e:
            hint = " (для students нужен EOS_AUTH_TOKEN)" if entity == "students" else ""
            raise CommandError(f"Синхронизация '{entity}' не выполнена: {e}{hint}")

        for stats in results:
            style = self.style.SUCCESS if stats.ok else self.style.WARNING
            self.stdout.write(style(stats.as_message()))
            for err in stats.errors[:30]:
                self.stdout.write(self.style.ERROR(f"  {err}"))
