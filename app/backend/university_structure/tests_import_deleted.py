"""
Импорт кафедр и групп из выгрузки ОИ пропускает строки, помеченные удалёнными: «Удалена» = 1 или «Да»
(в шаблоне ОИ колонка «Удалена (Да/Нет)», в примере - 0). Такая строка не заводит запись и не обновляет
существующую; 0, «Нет», пустое значение и NULL импортируются как обычно.
"""
from django.contrib.admin.sites import AdminSite
from django.contrib.messages.storage.fallback import FallbackStorage
from django.test import RequestFactory, TestCase, override_settings

from core.testing import TEST_SETTINGS, make_department, make_group
from university_structure.admin import DepartmentAdmin, GroupAdmin
from university_structure.models import Department, Group

DELETED = ("1", "Да", "да", " 1 ")
NOT_DELETED = ("0", "Нет", "", "NULL")


def _admin_request():
    request = RequestFactory().post("/admin/")
    setattr(request, "session", "session")
    setattr(request, "_messages", FallbackStorage(request))
    return request


@override_settings(**TEST_SETTINGS)
class DepartmentImportDeletedTests(TestCase):
    def setUp(self):
        self.department = make_department("К1")

    def _import(self, code, deleted):
        DepartmentAdmin(Department, AdminSite()).process_import(_admin_request(), [{
            "Код": code,
            "Название": f"Кафедра {code} из файла",
            "Сокращение": f"{code}-ф",
            "Код_Факультета": self.department.faculty.external_id,
            "Удалена": deleted,
        }])

    def test_deleted_row_is_not_created(self):
        for value in DELETED:
            with self.subTest(value=value):
                self._import(f"N{value}", value)

                self.assertFalse(Department.objects.filter(external_id=f"N{value}").exists())

    def test_deleted_row_does_not_update_existing(self):
        for value in DELETED:
            with self.subTest(value=value):
                self._import(self.department.external_id, value)

                self.department.refresh_from_db()
                self.assertEqual(self.department.name, "Кафедра К1")

    def test_not_deleted_row_is_imported(self):
        for value in NOT_DELETED:
            with self.subTest(value=value):
                self._import(f"N{value}", value)

                self.assertTrue(Department.objects.filter(external_id=f"N{value}", status=0).exists())


@override_settings(**TEST_SETTINGS)
class GroupImportDeletedTests(TestCase):
    def setUp(self):
        self.group = make_group(make_department("К1"), "ИВТ-101")

    def _import(self, code, deleted):
        GroupAdmin(Group, AdminSite()).process_import(_admin_request(), [{
            "Код": code,
            "Название": "ИВТ-101 из файла",
            "Код_специальности": self.group.specialty.external_id,
            "Курс": "2",
            "Учебныйгод": "2026-2027",
            "Удалена": deleted,
        }])

    def test_deleted_row_is_not_created(self):
        for value in DELETED:
            with self.subTest(value=value):
                self._import(f"N{value}", value)

                self.assertFalse(Group.objects.filter(external_id=f"N{value}").exists())

    def test_deleted_row_does_not_update_existing(self):
        for value in DELETED:
            with self.subTest(value=value):
                self._import(self.group.external_id, value)

                self.group.refresh_from_db()
                self.assertEqual((self.group.name, self.group.course), ("ИВТ-101", 1))

    def test_not_deleted_row_is_imported(self):
        for value in NOT_DELETED:
            with self.subTest(value=value):
                self._import(f"N{value}", value)

                self.assertTrue(Group.objects.filter(external_id=f"N{value}").exists())
