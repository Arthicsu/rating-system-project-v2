"""
Django-админка - только для суперпользователей ОИ.

Раньше импорт сотрудников ставил User.is_staff=True (вход в /admin/), а setup_roles
давал Dean/Rectorate права view_student/view_document: декан в админке видел всех
студентов и заявки вуза в обход своей области видимости. Признак «сотрудник вуза»
для фронта теперь отдельный - is_employee (есть staff_profile).
"""
from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group as AuthGroup
from django.contrib.messages.storage.fallback import FallbackStorage
from django.core.management import call_command
from django.test import RequestFactory, TestCase, override_settings
from django.urls import reverse

from rest_framework.test import APITestCase

from core.testing import TEST_SETTINGS, make_department, make_staff, make_student
from university_structure.admin import StaffAdmin
from university_structure.models import Staff

User = get_user_model()


def _admin_request():
    request = RequestFactory().post("/admin/")
    setattr(request, "session", "session")
    setattr(request, "_messages", FallbackStorage(request))
    return request


@override_settings(**TEST_SETTINGS)
class SessionExposesEmployeeFlagTests(APITestCase):
    def test_session_exposes_is_employee_not_is_staff(self):
        staff = make_staff("dept@uni.ru", "Department", department=make_department("К1"))
        self.client.force_authenticate(staff)

        data = self.client.get(reverse("api:auth-session")).data

        self.assertIs(data["is_employee"], True)
        self.assertNotIn("is_staff", data)

    def test_student_is_not_employee(self):
        self.client.force_authenticate(make_student("stud@uni.ru"))

        data = self.client.get(reverse("api:auth-session")).data

        self.assertIs(data["is_employee"], False)

    def test_staff_me_has_no_is_staff(self):
        staff = make_staff("dean@uni.ru", "Dean", faculty=make_department("К1").faculty)
        self.client.force_authenticate(staff)

        data = self.client.get(reverse("api:staff-me")).data

        self.assertNotIn("is_staff", data)


@override_settings(**TEST_SETTINGS)
class StaffImportAdminAccessTests(TestCase):
    def _import(self, **row):
        rows = [{"username": "kaf-x", "role": "", "password": "Imported-pass-1", **row}]
        StaffAdmin(Staff, AdminSite()).process_import(_admin_request(), rows)
        return User.objects.get(username="kaf-x")

    def test_staff_import_does_not_grant_admin(self):
        self.assertFalse(self._import().is_staff)

    def test_imported_employee_cannot_login_to_admin(self):
        self._import()

        resp = self.client.post(
            reverse("admin:login"),
            {"username": "kaf-x", "password": "Imported-pass-1", "next": "/admin/"},
        )

        # Вход в админку не состоялся: снова форма логина, а не редирект в админку.
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_setup_roles_clears_admin_perms(self):
        call_command("setup_roles", stdout=open("/dev/null", "w"))

        for role in ("Dean", "Rectorate", "Department", "Student"):
            self.assertFalse(AuthGroup.objects.get(name=role).permissions.exists(), role)
