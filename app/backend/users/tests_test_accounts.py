"""
Команда create_test_accounts: тестовые учётки для ручных проверок по ролям на dev-стенде.

Главное требование - команда не работает при DEBUG=False: учётки с известными
паролями не должны появиться на проде.
"""
import tempfile
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings

from core.testing import TEST_SETTINGS, make_department, make_group
from students.models import Student

User = get_user_model()


@override_settings(**TEST_SETTINGS)
class CreateTestAccountsTests(TestCase):
    def setUp(self):
        self.department = make_department("К1")
        make_group(self.department, "G1")

    @override_settings(DEBUG=False)
    def test_refuses_without_debug(self):
        with self.assertRaisesMessage(CommandError, "DEBUG=True"):
            call_command("create_test_accounts", department="К1")
        self.assertFalse(User.objects.filter(username__startswith="test_").exists())

    @override_settings(DEBUG=True)
    def test_unknown_department_is_an_error(self):
        with self.assertRaisesMessage(CommandError, "Кафедра «НЕТ-ТАКОЙ» не найдена"):
            call_command("create_test_accounts", department="НЕТ-ТАКОЙ")

    @override_settings(DEBUG=True)
    def test_creates_five_role_accounts_idempotently(self):
        with tempfile.TemporaryDirectory() as tmp, override_settings(BASE_DIR=Path(tmp)):
            call_command("create_test_accounts", department="К1")
            call_command("create_test_accounts", department="К1")  # повтор не плодит дублей

            self.assertEqual(User.objects.filter(username__startswith="test_").count(), 5)
            text = (Path(tmp) / "config-files" / "test_accounts.txt").read_text(encoding="utf-8")

        for login in ("test_student@bgitu.test", "test_archived@bgitu.test", "test_dept", "test_dean", "test_rector"):
            self.assertIn(login, text)

        student = Student.objects.get(user__username="test_student@bgitu.test")
        self.assertIsNone(student.archived_at)
        self.assertEqual(student.group.specialty.department, self.department)
        self.assertIsNotNone(Student.objects.get(user__username="test_archived@bgitu.test").archived_at)

        dept = User.objects.get(username="test_dept")
        self.assertEqual(dept.staff_profile.department, self.department)
        self.assertFalse(dept.is_staff)
        self.assertEqual(User.objects.get(username="test_dean").staff_profile.faculty, self.department.faculty)

    @override_settings(DEBUG=True)
    def test_password_in_file_works(self):
        with tempfile.TemporaryDirectory() as tmp, override_settings(BASE_DIR=Path(tmp)):
            call_command("create_test_accounts", department="К1")
            lines = (Path(tmp) / "config-files" / "test_accounts.txt").read_text(encoding="utf-8").splitlines()

        login, _role, password = next(line.split(";") for line in lines if line.startswith("test_dept;"))
        self.assertTrue(User.objects.get(username=login).check_password(password))
