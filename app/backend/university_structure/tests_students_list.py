"""
Тесты списка студентов сотрудника (/staff-profile → GET /api/v1/students/) с учётом семестра.

Текущий семестр — из живого кэша Student; прошлый — ВСЕ отфильтрованные студенты с баллами
выбранного семестра (0 у тех, у кого нет строки SemesterScore).
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
            "LOCATION": "students-list-tests",
        }
    },
    "PASSWORD_HASHERS": ["django.contrib.auth.hashers.MD5PasswordHasher"],
}

URL_NAME = "api:students-list"


@override_settings(**TEST_SETTINGS)
class FilteredStudentsSemesterTests(APITestCase):
    def setUp(self):
        cache.clear()
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

        Category.objects.create(code="academic", label="Учебная")
        Category.objects.create(code="sport", label="Спорт")

        rector_group, _ = AuthGroup.objects.get_or_create(name="Rectorate")
        self.staff_user = User.objects.create_user(username="rector@uni.ru", password="pass12345")
        self.staff_user.groups.add(rector_group)
        Staff.objects.create(user=self.staff_user)

        # Живой кэш (текущий семестр).
        self.a = Student.objects.create(external_id="EXT-A", full_name="Алексеев Алексей", record_book="RB-A", academic_score=10, sport_score=5)  # 15
        self.b = Student.objects.create(external_id="EXT-B", full_name="Борисов Борис", record_book="RB-B", academic_score=3)  # 3
        self.c = Student.objects.create(external_id="EXT-C", full_name="Викторов Виктор", record_book="RB-C", academic_score=7, sport_score=7)  # 14

        # История прошлого семестра — только у A и B (у C нет строки).
        SemesterScore.objects.create(student=self.a, semester=self.past, academic_score=2, sport_score=2)  # 4
        SemesterScore.objects.create(student=self.b, semester=self.past, academic_score=1)  # 1

    def _totals(self, params):
        self.client.force_authenticate(self.staff_user)
        resp = self.client.get(reverse(URL_NAME), params)
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        results = resp.data["results"] if isinstance(resp.data, dict) and "results" in resp.data else resp.data
        return {r["id"]: r["total_score"] for r in results}

    def test_current_semester_shows_live_scores_for_all(self):
        totals = self._totals({"academic_year": self.current.id})
        self.assertEqual(totals.get(self.a.id), 15)
        self.assertEqual(totals.get(self.b.id), 3)
        self.assertEqual(totals.get(self.c.id), 14)

    def test_past_semester_shows_all_students_zero_for_missing(self):
        totals = self._totals({"academic_year": self.past.id})
        # Все три студента присутствуют; у C нет истории → 0.
        self.assertEqual(set(totals.keys()), {self.a.id, self.b.id, self.c.id})
        self.assertEqual(totals[self.a.id], 4)
        self.assertEqual(totals[self.b.id], 1)
        self.assertEqual(totals[self.c.id], 0)
