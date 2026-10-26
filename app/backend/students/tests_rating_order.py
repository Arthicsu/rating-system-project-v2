"""
Порядок таблицы «Студенты» (GET /api/v1/rating/): сервер сортирует ВСЮ выборку до разбиения
на страницы — по баллам выбранной категории в выбранном направлении, при равенстве по ФИО.
На данных, где почти у всех 0 баллов, смена направления видимо почти ничего не меняет —
это равенство, а не сортировка одной страницы.
"""
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse

from rest_framework.test import APITestCase

from core.testing import TEST_SETTINGS, make_department, make_group, make_semester, make_staff, make_student
from students.models import SemesterScore, Student
from university_structure.models import AcademicYear

URL = "api:rating-list"
# ФИО -> (учебный, научный); общий = сумма: Борисов 5, Волков 3, Алексеев 2, Данилов 2, Гусев 0
SCORES = {"Борисов": (5, 0), "Алексеев": (0, 2), "Волков": (3, 0), "Гусев": (0, 0), "Данилов": (1, 1)}


@override_settings(**TEST_SETTINGS)
class RatingOrderTests(APITestCase):
    def setUp(self):
        cache.clear()
        AcademicYear.objects.all().delete()
        self.current = make_semester("2026-2027 Осенний", "2026-09-01", "2027-01-31", current=True)
        self.past = make_semester("2025-2026 Весенний", "2026-02-01", "2026-06-30")
        group = make_group(make_department("ИТ"), "ИТ-1")
        for name, (academic, research) in SCORES.items():
            user = make_student(f"{name}@uni.ru", group=group)
            # Живой кэш текущего семестра и история прошлого — одни и те же баллы.
            Student.objects.filter(user=user).update(full_name=name, academic_score=academic, research_score=research)
            SemesterScore.objects.create(
                student=user.student_profile, semester=self.past, academic_score=academic, research_score=research,
            )
        self.client.force_authenticate(make_staff("rector", "Rectorate"))

    def _all_pages(self, **params):
        names, page = [], 1
        while True:
            resp = self.client.get(reverse(URL), {"page_size": 2, "page": page, **params})
            self.assertEqual(resp.status_code, 200, resp.data)
            names += [row["full_name"] for row in resp.data["results"]]
            if not resp.data["next"]:
                return names
            page += 1

    def test_desc_by_total_over_all_pages(self):
        self.assertEqual(self._all_pages(direction="desc"), ["Борисов", "Волков", "Алексеев", "Данилов", "Гусев"])

    def test_asc_by_total_over_all_pages(self):
        # При равных баллах — по ФИО в обоих направлениях.
        self.assertEqual(self._all_pages(direction="asc"), ["Гусев", "Алексеев", "Данилов", "Волков", "Борисов"])

    def test_category_over_all_pages(self):
        self.assertEqual(
            self._all_pages(category="research", direction="desc"),
            ["Алексеев", "Данилов", "Борисов", "Волков", "Гусев"],
        )

    def test_past_semester_over_all_pages(self):
        self.assertEqual(
            self._all_pages(academic_year=self.past.id, direction="desc"),
            ["Борисов", "Волков", "Алексеев", "Данилов", "Гусев"],
        )
