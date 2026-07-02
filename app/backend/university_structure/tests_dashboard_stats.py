"""
Тесты статистики дашборда сотрудника с учётом выбранного семестра.

Проверяют, что селектор периода (academic_year) влияет на «Статистику»:
текущий семестр читается из живого кэша Student, прошлый — из истории SemesterScore
(количество, средний/макс/мин балл, суммы по категориям и топ-5).
"""
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group as AuthGroup
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from students.models import Category, Student, SemesterScore
from university_structure.models import AcademicYear, Staff

User = get_user_model()

TEST_SETTINGS = {
    "CACHES": {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "dashboard-stats-tests",
        }
    },
    "PASSWORD_HASHERS": ["django.contrib.auth.hashers.MD5PasswordHasher"],
}

URL_NAME = "university_structure:api_filtered_dashboard_stats"


@override_settings(**TEST_SETTINGS)
class DashboardStatsSemesterTests(APITestCase):
    def setUp(self):
        cache.clear()
        # Контролируем состояние семестров вручную (убираем период из data-миграции).
        AcademicYear.objects.all().delete()

        today = date.today()
        self.current = AcademicYear.objects.create(
            label="2025-2026 Весенний", start_date=today,
            end_date=today + timedelta(days=120), is_current=True,
        )
        self.past = AcademicYear.objects.create(
            label="2025-2026 Осенний", start_date=today - timedelta(days=200),
            end_date=today - timedelta(days=1), is_current=False,
        )

        self.academic = Category.objects.create(code="academic", label="Учебная")
        self.sport = Category.objects.create(code="sport", label="Спорт")

        # Сотрудник-ректорат видит всех студентов.
        rector_group, _ = AuthGroup.objects.get_or_create(name="Rectorate")
        self.staff_user = User.objects.create_user(username="rector@uni.ru", password="pass12345")
        self.staff_user.groups.add(rector_group)
        Staff.objects.create(user=self.staff_user)

        # Живой кэш (текущий семестр).
        self.student_a = Student.objects.create(
            external_id="EXT-A", full_name="Алексеев Алексей", record_book="RB-A",
            academic_score=10, sport_score=5,  # total 15
        )
        self.student_b = Student.objects.create(
            external_id="EXT-B", full_name="Борисов Борис", record_book="RB-B",
            academic_score=3, sport_score=0,  # total 3
        )

        # История прошлого семестра.
        SemesterScore.objects.create(
            student=self.student_a, semester=self.past, academic_score=2, sport_score=2,  # total 4
        )
        SemesterScore.objects.create(
            student=self.student_b, semester=self.past, academic_score=1, sport_score=0,  # total 1
        )

    def _get(self, params=None):
        self.client.force_authenticate(self.staff_user)
        return self.client.get(reverse(URL_NAME), params or {})

    def test_current_semester_uses_live_cache(self):
        resp = self._get({"academic_year": self.current.id})
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)

        stats = resp.data["stats"]
        self.assertEqual(stats["total_students"], 2)
        self.assertEqual(stats["avg_score"], 9.0)
        self.assertEqual(stats["max_score"], 15)
        self.assertEqual(stats["min_score"], 3)
        self.assertEqual(stats["categories"]["academic"], 13)
        self.assertEqual(stats["categories"]["sport"], 5)

    def test_no_semester_param_defaults_to_current(self):
        resp = self._get()
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.assertEqual(resp.data["stats"]["total_students"], 2)
        self.assertEqual(resp.data["stats"]["max_score"], 15)
        self.assertEqual(resp.data["stats"]["categories"]["academic"], 13)

    def test_past_semester_reads_history(self):
        resp = self._get({"academic_year": self.past.id})
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)

        stats = resp.data["stats"]
        self.assertEqual(stats["total_students"], 2)
        self.assertEqual(stats["avg_score"], 2.5)
        self.assertEqual(stats["max_score"], 4)
        self.assertEqual(stats["min_score"], 1)
        self.assertEqual(stats["categories"]["academic"], 3)
        self.assertEqual(stats["categories"]["sport"], 2)

    def test_past_semester_counts_all_filtered_students(self):
        # Новый студент с живыми баллами, но без строки истории за прошлый семестр.
        Student.objects.create(
            external_id="EXT-C", full_name="Викторов Виктор", record_book="RB-C",
            academic_score=7, sport_score=7,
        )

        current = self._get({"academic_year": self.current.id}).data["stats"]
        self.assertEqual(current["total_students"], 3)  # живой кэш видит всех

        past = self._get({"academic_year": self.past.id}).data["stats"]
        # Прошлый семестр показывает ВСЕХ отфильтрованных студентов; у C нет истории → 0.
        self.assertEqual(past["total_students"], 3)
        self.assertEqual(past["min_score"], 0)   # C без истории
        self.assertEqual(past["max_score"], 4)   # A = 4
        # Суммы по категориям не меняются (C добавляет 0).
        self.assertEqual(past["categories"]["academic"], 3)
        self.assertEqual(past["categories"]["sport"], 2)

    def test_top5_shape_and_semester_ordering(self):
        current_top = self._get({"academic_year": self.current.id}).data["top5"]
        self.assertEqual([s["total_score"] for s in current_top], [15, 3])
        self.assertEqual(current_top[0]["id"], self.student_a.id)
        # Контракт StudentSimple: id, full_name, total_score.
        self.assertEqual(set(current_top[0].keys()), {"id", "full_name", "total_score"})

        past_top = self._get({"academic_year": self.past.id}).data["top5"]
        self.assertEqual([s["total_score"] for s in past_top], [4, 1])
        self.assertEqual(past_top[0]["id"], self.student_a.id)
