"""
Период в рейтинге, списке студентов, статистике, заявках и Excel: учебный год (year_start)
или один семестр (academic_year / semester). Без параметров - текущий учебный год из живого
кэша; прошлый год и отдельный семестр (в том числе текущего года) - суммы SemesterScore.
"""
import io
import zipfile

from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse

from rest_framework.test import APITestCase

from core.testing import (
    TEST_SETTINGS, make_catalog, make_department, make_doc, make_group, make_semester, make_staff,
    make_statuses, make_student,
)
from students.models import SemesterScore
from students.services import rebuild_current_semester_cache


@override_settings(**TEST_SETTINGS)
class PeriodTests(APITestCase):
    def setUp(self):
        cache.clear()
        make_catalog()
        self.past_autumn = make_semester(2024, "autumn")
        self.past_spring = make_semester(2024, "spring")
        self.autumn = make_semester(2025, "autumn", current=True)
        self.spring = make_semester(2025, "spring")
        group = make_group(make_department("К1"), "ИВТ-101")
        self.user = make_student("s@uni.ru", group=group)
        self.student = self.user.student_profile
        for semester, points in ((self.past_autumn, 5), (self.past_spring, 7), (self.autumn, 10), (self.spring, 4)):
            SemesterScore.objects.create(student=self.student, semester=semester, academic_score=points)
        rebuild_current_semester_cache()
        self.client.force_authenticate(make_staff("rector", "Rectorate"))

    def _rating_total(self, **params):
        rows = self.client.get(reverse("api:rating-list"), params).data["results"]
        return next(r["total_score"] for r in rows if r["id"] == self.student.id)

    def test_default_period_is_live_current_year(self):
        self.assertEqual(self._rating_total(), 14)
        self.assertEqual(self._rating_total(year_start=2025), 14)

    def test_past_year_sums_two_semesters(self):
        self.assertEqual(self._rating_total(year_start=2024), 12)

        rows = self.client.get(reverse("api:students-list"), {"year_start": 2024}).data["results"]
        self.assertEqual(next(r["total_score"] for r in rows if r["id"] == self.student.id), 12)

    def test_single_semester_of_current_year_uses_history(self):
        self.assertEqual(self._rating_total(academic_year=self.autumn.id), 10)
        self.assertEqual(self._rating_total(semester=self.spring.id), 4)

    def test_requests_list_filtered_by_year(self):
        statuses, catalog = make_statuses(), make_catalog()
        # Ректорат в очереди видит одобренные кафедрой заявки (контроль).
        old = make_doc(self.user, catalog, statuses["approved"], semester=self.past_spring)
        new = make_doc(self.user, catalog, statuses["approved"], semester=self.spring)
        url = reverse("api:achievements-list")

        def ids(**params):
            return [d["id"] for d in self.client.get(url, params).data["results"]]

        self.assertEqual(ids(), [new.id])
        self.assertEqual(ids(year_start=2024), [old.id])
        self.assertEqual(ids(academic_year=self.past_spring.id), [old.id])

    def test_stats_follow_period(self):
        stats = self.client.get(reverse("api:achievements-list"), {"year_start": 2024}).data["stats"]

        self.assertEqual((stats["max_score"], stats["categories"]["academic"]), (12, 12))

    def test_export_label_year(self):
        resp = self.client.get(reverse("api:rating-export"), {"year_start": 2024})

        self.assertIn("2024-2025", resp["Content-Disposition"])
        with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
            self.assertIn("2024-2025 уч. год", zf.read("xl/sharedStrings.xml").decode("utf-8"))

    def test_non_numeric_period_ignored(self):
        self.assertEqual(self._rating_total(year_start="abc", academic_year="x"), 14)

    def test_header_pending_count_covers_current_year(self):
        statuses, catalog = make_statuses(), make_catalog()
        for semester in (self.autumn, self.spring, self.past_spring):
            make_doc(self.user, catalog, statuses["approved"], semester=semester)

        resp = self.client.get(reverse("api:notifications-pending-count"))

        self.assertEqual(resp.data["pending_docs_count"], 2)
