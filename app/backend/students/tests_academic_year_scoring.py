"""
Живой рейтинг = текущий учебный год (сумма его осени и весны); семестр заявки - по дате
достижения. Заявка прошлого года уходит в его историю, в живой рейтинг не попадает.
"""
from datetime import date, timedelta

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase

from core.testing import FILE_TEST_SETTINGS, make_catalog, make_doc, make_semester, make_statuses, make_student
from students.models import Document, SemesterScore
from students.services import credit_document, rollover_semester

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


@override_settings(**FILE_TEST_SETTINGS)
class AcademicYearScoringTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.statuses = make_statuses()
        self.catalog = make_catalog(score=10)
        self.past_spring = make_semester(2024, "spring")
        self.autumn = make_semester(2025, "autumn", current=True)
        self.spring = make_semester(2025, "spring")
        self.user = make_student("s@uni.ru")
        self.student = self.user.student_profile

    def _approve(self, semester):
        credit_document(make_doc(self.user, self.catalog, self.statuses["approved"], semester=semester))

    def _live(self):
        self.student.refresh_from_db()
        return self.student.total_score

    def _history(self, semester):
        return SemesterScore.objects.get(student=self.student, semester=semester).total_score

    def _upload(self, day):
        self.client.force_authenticate(self.user)
        return self.client.post(
            reverse("api:achievements-list"),
            data={
                "record_book": self.student.record_book, "category": "academic", "sub_type": "olympiad",
                "achievement": "Олимпиада", "doc_type": "other", "date_received": day.isoformat(),
                "files": [SimpleUploadedFile("proof.png", PNG, content_type="image/png")],
            },
            format="multipart",
        )

    def test_cache_sums_both_semesters_of_current_year(self):
        self._approve(self.autumn)
        self._approve(self.spring)

        self.assertEqual(self._live(), 20)

    def test_switch_autumn_to_spring_keeps_cache(self):
        self._approve(self.autumn)

        rollover_semester(to_semester=self.spring)

        self.assertEqual(self._live(), 10)
        self.assertEqual(self._history(self.autumn), 10)

    def test_new_year_zeroes_cache_keeps_history(self):
        self._approve(self.autumn)
        self._approve(self.spring)

        rollover_semester(to_semester=make_semester(2026, "autumn"))

        self.assertEqual(self._live(), 0)
        self.assertEqual((self._history(self.autumn), self._history(self.spring)), (10, 10))

    def test_past_year_achievement_not_in_live_rating(self):
        self._approve(self.past_spring)

        self.assertEqual(self._live(), 0)
        self.assertEqual(self._history(self.past_spring), 10)

    def test_upload_tagged_by_achievement_date(self):
        self.assertEqual(self._upload(date(2026, 3, 10)).status_code, status.HTTP_201_CREATED)
        self.assertEqual(self._upload(date(2025, 10, 15)).status_code, status.HTTP_201_CREATED)
        self.assertEqual(self._upload(date(2025, 5, 20)).status_code, status.HTTP_201_CREATED)

        semesters = list(Document.objects.order_by("id").values_list("semester_id", flat=True))
        self.assertEqual(semesters, [self.spring.id, self.autumn.id, self.past_spring.id])

    def test_edit_date_moves_semester(self):
        self._upload(date(2025, 10, 15))
        doc = Document.objects.get(user=self.user)

        resp = self.client.patch(
            reverse("api:achievements-detail", args=[doc.public_id]), {"date_received": "2026-03-10"}, format="multipart",
        )

        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        doc.refresh_from_db()
        self.assertEqual(doc.semester_id, self.spring.id)

    def test_future_date_rejected(self):
        resp = self._upload(timezone.localdate() + timedelta(days=1))

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("date_received", resp.data)
        self.assertFalse(Document.objects.exists())

    def test_date_without_semester_rejected(self):
        resp = self._upload(date(2019, 5, 1))

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("нет учебного семестра", str(resp.data["date_received"]))
        self.assertFalse(Document.objects.exists())

        self._upload(date(2025, 10, 15))
        doc = Document.objects.get(user=self.user)
        resp = self.client.patch(
            reverse("api:achievements-detail", args=[doc.public_id]), {"date_received": "2019-05-01"}, format="multipart",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        doc.refresh_from_db()
        self.assertEqual((doc.date_received, doc.semester_id), (date(2025, 10, 15), self.autumn.id))

    def test_rollover_does_not_rewrite_history(self):
        self._approve(self.autumn)
        self._approve(self.spring)

        rollover_semester(to_semester=self.spring)

        self.assertEqual((self._history(self.autumn), self._history(self.spring)), (10, 10))
