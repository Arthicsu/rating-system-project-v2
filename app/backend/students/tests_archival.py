"""
Тесты архивации студентов (soft-delete) при синхронизации из CSV.

Покрывают:
- скоупы менеджера active()/archived() и хелперы модели archive()/unarchive();
- импорт: терминальный статус (3/4/6) архивирует существующего студента, не создаёт новых,
  сохраняет пользователя; активный статус возвращает студента из архива;
- архивацию отсутствующих в файле (опция archive_absent) строго в рамках групп из файла;
- исключение архивных из «живого» списка студентов сотрудника (API).

Паттерн изоляции (locmem-кэш) — см. [[backend-api-tests]].
"""
from datetime import date, timedelta

from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group as AuthGroup
from django.contrib.messages.storage.fallback import FallbackStorage
from django.core.cache import cache
from django.test import TestCase, RequestFactory, override_settings
from django.urls import reverse
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase

from students.admin import StudentAdmin
from students.models import Student, Category
from university_structure.models import Group, AcademicYear, Staff

User = get_user_model()


def make_group(ext, name):
    return Group.objects.create(
        external_id=ext, name=name, course=1, academic_year="2025-2026",
        education_level="-", education_level_decode="",
        education_form="-", education_form_decode="",
    )


class StudentArchivalModelTests(TestCase):
    def test_active_and_archived_scopes(self):
        a = Student.objects.create(external_id="A", full_name="A")
        b = Student.objects.create(external_id="B", full_name="B", archived_at=timezone.now())
        self.assertEqual(list(Student.objects.active()), [a])
        self.assertEqual(list(Student.objects.archived()), [b])
        self.assertTrue(a.is_active)
        self.assertFalse(b.is_active)

    def test_archive_and_unarchive_helpers(self):
        s = Student.objects.create(external_id="A", full_name="A", status="1")
        s.archive(status="3", status_decoding="Отчислен")
        s.refresh_from_db()
        self.assertIsNotNone(s.archived_at)
        self.assertEqual(s.status, "3")
        self.assertEqual(s.status_decoding, "Отчислен")
        self.assertFalse(s.is_active)

        s.unarchive()
        s.refresh_from_db()
        self.assertIsNone(s.archived_at)
        self.assertTrue(s.is_active)


class StudentCsvImportArchivalTests(TestCase):
    def setUp(self):
        self.admin = StudentAdmin(Student, AdminSite())
        self.factory = RequestFactory()
        AuthGroup.objects.get_or_create(name="Student")
        self.g1 = make_group("G1", "ИВТ-101")
        self.g2 = make_group("G2", "ИВТ-201")

    def _request(self, post=None):
        request = self.factory.post("/", post or {})
        setattr(request, "session", {})
        setattr(request, "_messages", FallbackStorage(request))
        return request

    def _student(self, ext, group=None, archived=False, status="1"):
        user = User.objects.create_user(username=f"{ext}@bgitu.ru", password="x")
        return Student.objects.create(
            external_id=ext, full_name=f"Студент {ext}", user=user, group=group,
            status=status, archived_at=timezone.now() if archived else None,
        )

    def test_terminal_status_archives_existing_without_deleting(self):
        s = self._student("S1", group=self.g1)
        data = [{"Код": "S1", "Статус": "3", "Фамилия": "Иванов", "Имя": "Иван", "Отчество": "Иванович"}]
        self.admin.process_import_csv(self._request(), data)
        s.refresh_from_db()
        self.assertIsNotNone(s.archived_at)
        self.assertEqual(s.status, "3")
        # Запись и пользователь сохранены (soft-delete, а не удаление).
        self.assertTrue(Student.objects.filter(pk=s.pk).exists())
        self.assertTrue(User.objects.filter(pk=s.user_id).exists())

    def test_terminal_status_does_not_create_new_student(self):
        data = [{"Код": "NEW", "Статус": "4", "Фамилия": "Н", "Имя": "Н", "Отчество": "Н"}]
        self.admin.process_import_csv(self._request(), data)
        self.assertFalse(Student.objects.filter(external_id="NEW").exists())

    def test_active_status_unarchives_returning_student(self):
        s = self._student("S2", group=self.g1, archived=True, status="6")
        data = [{"Код": "S2", "Статус": "1", "Код_Группы": "G1",
                 "Фамилия": "П", "Имя": "П", "Отчество": "П"}]
        self.admin.process_import_csv(self._request(), data)
        s.refresh_from_db()
        self.assertIsNone(s.archived_at)
        self.assertEqual(s.status, "1")

    def test_archive_absent_scoped_to_groups_in_file(self):
        present = self._student("P", group=self.g1)
        absent = self._student("ABS", group=self.g1)
        other = self._student("OTH", group=self.g2)
        data = [{"Код": "P", "Статус": "1", "Код_Группы": "G1",
                 "Фамилия": "П", "Имя": "П", "Отчество": "П"}]
        self.admin.process_import_csv(self._request({"archive_absent": "on"}), data)
        for s in (present, absent, other):
            s.refresh_from_db()
        self.assertIsNone(present.archived_at)      # активен в файле
        self.assertIsNotNone(absent.archived_at)    # та же группа, но отсутствует -> в архив
        self.assertEqual(absent.status, "6")
        self.assertIsNone(other.archived_at)        # другая группа (нет в файле) -> не трогаем

    def test_absent_not_archived_without_flag(self):
        present = self._student("P", group=self.g1)
        absent = self._student("ABS", group=self.g1)
        data = [{"Код": "P", "Статус": "1", "Код_Группы": "G1",
                 "Фамилия": "П", "Имя": "П", "Отчество": "П"}]
        self.admin.process_import_csv(self._request(), data)  # без archive_absent
        absent.refresh_from_db()
        self.assertIsNone(absent.archived_at)


TEST_SETTINGS = {
    "CACHES": {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "archival-tests",
        }
    },
    "PASSWORD_HASHERS": ["django.contrib.auth.hashers.MD5PasswordHasher"],
}


@override_settings(**TEST_SETTINGS)
class ArchivedExcludedFromRosterAPITests(APITestCase):
    def setUp(self):
        cache.clear()
        AcademicYear.objects.all().delete()
        today = date.today()
        AcademicYear.objects.create(
            label="Текущий", start_date=today, end_date=today + timedelta(days=100), is_current=True,
        )
        Category.objects.create(code="academic", label="Учебная")

        rector, _ = AuthGroup.objects.get_or_create(name="Rectorate")
        self.staff = User.objects.create_user(username="rector@uni.ru", password="pass12345")
        self.staff.groups.add(rector)
        Staff.objects.create(user=self.staff)

        self.active1 = Student.objects.create(external_id="A1", full_name="Активный 1", record_book="R1", academic_score=5)
        self.active2 = Student.objects.create(external_id="A2", full_name="Активный 2", record_book="R2", academic_score=3)
        self.archived = Student.objects.create(
            external_id="AR", full_name="Архивный", record_book="R3", academic_score=9,
            archived_at=timezone.now(),
        )

    def test_archived_not_in_current_roster(self):
        self.client.force_authenticate(self.staff)
        resp = self.client.get(reverse("university_structure:api_filtered_students"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        results = resp.data["results"] if isinstance(resp.data, dict) and "results" in resp.data else resp.data
        ids = {r["id"] for r in results}
        self.assertIn(self.active1.id, ids)
        self.assertIn(self.active2.id, ids)
        self.assertNotIn(self.archived.id, ids)
