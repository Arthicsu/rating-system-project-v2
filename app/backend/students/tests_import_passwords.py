"""
Импорт студентов без паролей и массовый сброс паролей студентов.

Пароль студент теперь получает сам по почте («Регистрация» / «Восстановить пароль»),
поэтому импорт создаёт пользователей с неиспользуемым паролем и не пишет CSV
с паролями. Заодно импорт перестаёт хэшировать пароль на каждого нового студента.
"""
import tempfile
from io import StringIO
from pathlib import Path
from unittest.mock import patch

from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from django.contrib.messages.storage.fallback import FallbackStorage
from django.core.management import call_command
from django.test import RequestFactory, TestCase, override_settings

from core.testing import TEST_SETTINGS, make_department, make_group, make_staff, make_student
from students.admin import StudentAdmin
from students.models import Student

User = get_user_model()


def _row(code, email, group_code):
    return {
        "Код": code, "Статус": "1", "Код_Группы": group_code, "E_Mail": email,
        "Фамилия": "Иванов", "Имя": "Иван", "Отчество": "Иванович",
    }


@override_settings(**TEST_SETTINGS)
class ImportWithoutPasswordsTests(TestCase):
    def setUp(self):
        self.group = make_group(make_department("К1"), "G1")

    def _import(self, rows):
        request = RequestFactory().post("/")
        setattr(request, "session", {})
        setattr(request, "_messages", FallbackStorage(request))
        StudentAdmin(Student, AdminSite()).process_import(request, rows)

    def test_import_creates_student_without_usable_password(self):
        self._import([_row("NEW1", "new@x.ru", self.group.external_id)])

        user = User.objects.get(username="new@x.ru")
        self.assertFalse(user.has_usable_password())

    def test_import_writes_no_password_csv(self):
        with tempfile.TemporaryDirectory() as tmp, override_settings(IMPORT_PASSWORDS_DIR=tmp):
            self._import([_row("NEW1", "new@x.ru", self.group.external_id)])
            self.assertEqual(list(Path(tmp).iterdir()), [])

    def test_import_does_not_hash_passwords(self):
        with patch("django.contrib.auth.hashers.get_hasher") as get_hasher:
            self._import([_row(f"N{i}", f"n{i}@x.ru", self.group.external_id) for i in range(3)])

        self.assertEqual(Student.objects.count(), 3)
        get_hasher.assert_not_called()


@override_settings(**TEST_SETTINGS)
class ResetStudentPasswordsTests(TestCase):
    def setUp(self):
        self.student = make_student("stud@uni.ru")
        self.staff = make_staff("kaf-x", "Department", department=make_department("К1"))
        self.super_student = make_student("admin@uni.ru")
        self.super_student.is_superuser = True
        self.super_student.save(update_fields=["is_superuser"])

    def _run(self, *args):
        out = StringIO()
        call_command("reset_student_passwords", *args, stdout=out)
        return out.getvalue()

    def test_dry_run_changes_nothing(self):
        output = self._run("--dry-run")

        self.student.refresh_from_db()
        self.assertTrue(self.student.has_usable_password())
        self.assertIn("1", output)

    def test_reset_makes_student_password_unusable(self):
        self._run()

        self.student.refresh_from_db()
        self.assertFalse(self.student.has_usable_password())

    def test_reset_skips_staff_and_superusers(self):
        self._run()

        self.staff.refresh_from_db()
        self.super_student.refresh_from_db()
        self.assertTrue(self.staff.has_usable_password())
        self.assertTrue(self.super_student.has_usable_password())
