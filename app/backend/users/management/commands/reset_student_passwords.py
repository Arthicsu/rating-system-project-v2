"""
Массовый сброс паролей студентов на неиспользуемые.

Пример:
    python manage.py reset_student_passwords --dry-run   # только посчитать
    python manage.py reset_student_passwords

Нужен при переходе на выдачу паролей по почте: пароли, розданные раньше «на
листочках» из CSV, перестают работать, студент получает новый через «Регистрацию».
Сотрудники и суперпользователи не затрагиваются. Активные сессии студентов гаснут
сами - Django сверяет хэш пароля, сохранённый в сессии.
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Делает пароли всех студентов неиспользуемыми (сотрудники и суперпользователи не затрагиваются)."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Только показать, сколько студентов затронет.")

    def handle(self, *args, **options):
        students = get_user_model().objects.filter(
            student_profile__isnull=False, staff_profile__isnull=True, is_superuser=False,
        )
        count = students.count()

        if options["dry_run"]:
            self.stdout.write(f"[dry-run] Будет сброшено паролей студентов: {count}")
            return

        with transaction.atomic():
            # По одному: у каждого свой случайный неиспользуемый хэш (make_password(None)).
            for user in students.only("pk").iterator():
                user.password = make_password(None)
                user.save(update_fields=["password"])

        self.stdout.write(self.style.SUCCESS(
            f"Сброшено паролей студентов: {count}. Новый пароль студент получает через «Регистрацию»."
        ))
