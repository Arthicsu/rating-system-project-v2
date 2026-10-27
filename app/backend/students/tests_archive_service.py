"""
Архивация студента блокирует вход: archive_students/unarchive_students меняют archived_at
и User.is_active вместе - в админке, при импорте и в Student.archive()/unarchive().
"""
import importlib

from django.apps import apps
from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group as AuthGroup
from django.contrib.messages.storage.fallback import FallbackStorage
from django.core.cache import cache
from django.test import RequestFactory, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase

from core.testing import DEFAULT_PASSWORD, TEST_SETTINGS, make_department, make_group, make_student
from students.admin import StudentAdmin
from students.models import Student
from students.services import archive_students, unarchive_students
from university_structure.models import Staff

User = get_user_model()


def _profile(user):
    return Student.objects.get(user=user)


@override_settings(**TEST_SETTINGS)
class ArchiveServiceTests(TestCase):
    def test_archive_deactivates_user(self):
        user = make_student("s@uni.ru")

        count = archive_students(Student.objects.filter(user=user), status="3")

        user.refresh_from_db()
        student = _profile(user)
        self.assertEqual(count, 1)
        self.assertFalse(user.is_active)
        self.assertIsNotNone(student.archived_at)
        self.assertEqual((student.status, student.status_decoding), ("3", "Отчислен"))

    def test_unarchive_reactivates_user(self):
        user = make_student("s@uni.ru", archived=True)
        User.objects.filter(pk=user.pk).update(is_active=False)

        count = unarchive_students(Student.objects.filter(user=user))

        user.refresh_from_db()
        self.assertEqual(count, 1)
        self.assertTrue(user.is_active)
        self.assertIsNone(_profile(user).archived_at)

    def test_archive_keeps_staff_account_active(self):
        user = make_student("s@uni.ru")
        Staff.objects.create(user=user)

        archive_students(Student.objects.filter(user=user))

        user.refresh_from_db()
        self.assertTrue(user.is_active)
        self.assertIsNotNone(_profile(user).archived_at)

    def test_unarchive_keeps_blocked_staff_account_blocked(self):
        user = make_student("s@uni.ru", archived=True)
        Staff.objects.create(user=user)
        User.objects.filter(pk=user.pk).update(is_active=False)

        unarchive_students(Student.objects.filter(user=user))

        user.refresh_from_db()
        self.assertFalse(user.is_active)

    def test_archive_skips_already_archived(self):
        user = make_student("s@uni.ru", archived=True)
        before = _profile(user).archived_at

        self.assertEqual(archive_students(Student.objects.filter(user=user)), 0)
        self.assertEqual(_profile(user).archived_at, before)

    def test_model_helpers_use_service(self):
        user = make_student("s@uni.ru")
        student = _profile(user)

        student.archive(status="4", status_decoding="Окончил")
        user.refresh_from_db()
        self.assertFalse(user.is_active)
        self.assertEqual(student.status, "4")
        self.assertIsNotNone(student.archived_at)

        student.unarchive()
        user.refresh_from_db()
        self.assertTrue(user.is_active)
        self.assertIsNone(student.archived_at)

    def test_migration_deactivates_already_archived(self):
        archived = make_student("old@uni.ru", archived=True)
        active = make_student("new@uni.ru")
        staff = make_student("emp@uni.ru", archived=True)
        Staff.objects.create(user=staff)

        migration = importlib.import_module("students.migrations.0005_archived_students_inactive")
        migration.deactivate_archived_users(apps, None)

        for user in (archived, active, staff):
            user.refresh_from_db()
        self.assertFalse(archived.is_active)
        self.assertTrue(active.is_active)
        self.assertTrue(staff.is_active)


@override_settings(**TEST_SETTINGS)
class ArchivedSignInTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = make_student("s@uni.ru")

    def _login(self):
        return self.client.post(reverse("api:auth-login"), {"username": "s@uni.ru", "password": DEFAULT_PASSWORD})

    def _archive(self):
        archive_students(Student.objects.filter(user=self.user))

    def test_archived_cannot_login(self):
        self._archive()

        self.assertEqual(self._login().status_code, status.HTTP_401_UNAUTHORIZED)

    def test_archived_user_session_is_dropped(self):
        self.assertEqual(self._login().status_code, status.HTTP_200_OK)

        self._archive()

        self.assertFalse(self.client.get(reverse("api:auth-session")).data["isAuthenticated"])

    def test_archived_cannot_change_password(self):
        self.assertEqual(self._login().status_code, status.HTTP_200_OK)
        self._archive()

        resp = self.client.post(
            reverse("api:auth-change-password"),
            {"old_password": DEFAULT_PASSWORD, "new_password": "N3w-strong-pass!"},
        )

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(DEFAULT_PASSWORD))


@override_settings(**TEST_SETTINGS)
class ArchiveCallersTests(TestCase):
    def setUp(self):
        self.admin = StudentAdmin(Student, AdminSite())
        AuthGroup.objects.get_or_create(name="Student")
        self.group = make_group(make_department("К1"), "ИВТ-101")

    def _request(self, post=None):
        request = RequestFactory().post("/", post or {})
        request.session = {}
        request._messages = FallbackStorage(request)
        return request

    def _archived_student(self, username):
        user = make_student(username, group=self.group, archived=True)
        User.objects.filter(pk=user.pk).update(is_active=False)
        return user

    def _row(self, user, status_code):
        return {
            "Код": _profile(user).external_id, "Статус": status_code, "Код_Группы": self.group.external_id,
            "Фамилия": "Иванов", "Имя": "Иван", "Отчество": "Иванович", "E_Mail": user.email,
        }

    def test_import_terminal_status_deactivates(self):
        user = make_student("s@uni.ru", group=self.group)

        self.admin.process_import(self._request(), [self._row(user, "3")])

        user.refresh_from_db()
        self.assertFalse(user.is_active)
        self.assertEqual(_profile(user).status, "3")

    def test_import_active_status_reactivates(self):
        user = self._archived_student("s@uni.ru")

        self.admin.process_import(self._request(), [self._row(user, "1")])

        user.refresh_from_db()
        self.assertTrue(user.is_active)
        self.assertIsNone(_profile(user).archived_at)

    def test_import_active_row_keeps_blocked_account_blocked(self):
        user = make_student("s@uni.ru", group=self.group)
        User.objects.filter(pk=user.pk).update(is_active=False)

        self.admin.process_import(self._request(), [self._row(user, "1")])

        user.refresh_from_db()
        self.assertFalse(user.is_active)

    def test_import_archive_absent_deactivates(self):
        present = make_student("p@uni.ru", group=self.group)
        absent = make_student("a@uni.ru", group=self.group)

        self.admin.process_import(self._request({"archive_absent": "on"}), [self._row(present, "1")])

        absent.refresh_from_db()
        self.assertFalse(absent.is_active)
        self.assertEqual(_profile(absent).status, "6")

    def test_admin_action_archive_deactivates(self):
        user = make_student("s@uni.ru", group=self.group)

        self.admin.action_archive(self._request(), Student.objects.filter(user=user))

        user.refresh_from_db()
        self.assertFalse(user.is_active)
        self.assertIsNotNone(_profile(user).archived_at)

    def test_admin_action_unarchive_reactivates(self):
        user = self._archived_student("s@uni.ru")

        self.admin.action_unarchive(self._request(), Student.objects.filter(user=user))

        user.refresh_from_db()
        self.assertTrue(user.is_active)
