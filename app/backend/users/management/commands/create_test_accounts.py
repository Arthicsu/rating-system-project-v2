"""
Тестовые учётки для ручных проверок по ролям на dev-стенде.

Пример:
    python manage.py create_test_accounts # кафедра ит
    python manage.py create_test_accounts --department ЭиЭБ

Создаёт (или обновляет) пять учёток вокруг одной кафедры: студент, архивный
студент, кафедра, декан её факультета и ректорат. При каждом запуске пароли
генерируются заново и пишутся в config-files/test_accounts.txt (каталог в
.gitignore); в консоль пароли не печатаются.

Работает только при DEBUG=True: учётки с известными паролями не должны
появиться на проде.
"""
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group as AuthGroup
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from core.admin_password_generator import generate_password
from students.models import Student
from university_structure.models import Department, Group, Staff

User = get_user_model()


class Command(BaseCommand):
    help = "Тестовые учётки по ролям для dev-стенда (только при DEBUG=True)."

    def add_arguments(self, parser):
        parser.add_argument("--department", default="ИТ",
                            help="Сокращённое название кафедры (по умолчанию ИТ).")

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Команда работает только на dev-стенде (DEBUG=True).")

        short_name = options["department"]
        department = Department.objects.select_related("faculty").filter(short_name=short_name).first()
        if department is None:
            raise CommandError(f"Кафедра «{short_name}» не найдена.")

        group = (
            Group.objects.filter(specialty__department=department)
            .order_by("course", "name").first()
        )
        if group is None:
            raise CommandError(f"У кафедры «{short_name}» нет ни одной группы.")

        credentials = []
        with transaction.atomic():
            credentials.append(self._student("test_student@bgitu.test", "Студент", group, archived=False))
            credentials.append(self._student("test_archived@bgitu.test", "Архивный", group, archived=True))
            credentials.append(self._staff("test_dept", "Department", department=department, faculty=department.faculty))
            credentials.append(self._staff("test_dean", "Dean", faculty=department.faculty))
            credentials.append(self._staff("test_rector", "Rectorate"))

        target = settings.BASE_DIR / "config-files" / "test_accounts.txt"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(
            "\n".join(f"{login};{role};{password}" for login, role, password in credentials) + "\n",
            encoding="utf-8",
        )
        self.stdout.write(self.style.SUCCESS(f"Тестовые учётки обновлены, данные для входа: {target}"))

    def _user(self, username, role, **fields):
        password = generate_password()
        user, _ = User.objects.update_or_create(
            username=username, defaults={"is_staff": False, "is_superuser": False, "is_active": True, **fields},
        )
        user.set_password(password)
        user.save(update_fields=["password"])
        user.groups.set([AuthGroup.objects.get_or_create(name=role)[0]])
        return user, password

    def _student(self, username, last_name, group, *, archived):
        user, password = self._user(
            username, "Student", email=username, last_name=last_name, first_name="Тестовый",
            is_active=not archived,
        )
        department = group.specialty.department
        Student.objects.update_or_create(
            user=user,
            defaults={
                "external_id": f"TEST-{username}",
                "full_name": user.get_full_username(),
                "record_book": f"TEST-{last_name}",
                "email": username,
                "group": group,
                "faculty": department.faculty,
                "department": department,
                "status": "6" if archived else "1",
                "status_decoding": Student.STATUS_DECODINGS["6" if archived else "1"],
                "archived_at": timezone.now() if archived else None,
            },
        )
        return username, "Архивный студент" if archived else "Студент", password

    def _staff(self, username, role, *, department=None, faculty=None):
        user, password = self._user(username, role)
        Staff.objects.update_or_create(
            user=user, defaults={"department": department, "faculty": faculty, "email": ""},
        )
        return username, role, password
