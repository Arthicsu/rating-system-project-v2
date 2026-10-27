from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from core.testing import TEST_SETTINGS, make_catalog, make_doc, make_semester, make_statuses, make_student

from students.models import (
    Category,
    AchievementType,
    DocType,
    Document,
    DocumentStatus,
    Student,
)

User = get_user_model()

TEST_SETTINGS = {
    "CACHES": {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "students-tests",
        }
    },
    "PASSWORD_HASHERS": ["django.contrib.auth.hashers.MD5PasswordHasher"],
}

URL_NAME = "api:achievements-detail"


@override_settings(**TEST_SETTINGS)
class AchievementDeleteTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.approved = DocumentStatus.objects.create(code="approved", label="Подтверждено")
        self.pending = DocumentStatus.objects.create(code="pending", label="На рассмотрении")
        self.category = Category.objects.create(code="academic", label="Учебная")
        self.sub_type = AchievementType.objects.create(
            category=self.category, code="olympiad", label="Олимпиада"
        )
        self.doc_type = DocType.objects.create(code="other", label="Другое")

        self.user = User.objects.create_user(username="stud@uni.ru", password="pass12345")
        Student.objects.create(
            user=self.user, external_id="EXT-1", full_name="Студент", record_book="RB-1"
        )

    def _make_doc(self, status_obj, user=None):
        return Document.objects.create(
            user=user or self.user,
            category=self.category,
            sub_type=self.sub_type,
            doc_type=self.doc_type,
            status=status_obj,
            achievement="Тестовое достижение",
        )

    def test_delete_approved_is_forbidden(self):
        """Подтверждённое достижение нельзя удалить даже прямым запросом к ручке."""
        doc = self._make_doc(self.approved)
        self.client.force_authenticate(self.user)

        resp = self.client.delete(reverse(URL_NAME, args=[doc.pk]))

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        # Единый формат ошибок API: {"detail": "..."}
        self.assertIn("detail", resp.json())
        # Заявка осталась на месте.
        self.assertTrue(Document.objects.filter(pk=doc.pk).exists())

    def test_delete_pending_succeeds(self):
        doc = self._make_doc(self.pending)
        self.client.force_authenticate(self.user)

        resp = self.client.delete(reverse(URL_NAME, args=[doc.pk]))

        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Document.objects.filter(pk=doc.pk).exists())

    def test_delete_other_users_doc_returns_404(self):
        """Чужую заявку не видно и удалить нельзя."""
        other = User.objects.create_user(username="other@uni.ru", password="pass12345")
        doc = self._make_doc(self.pending, user=other)
        self.client.force_authenticate(self.user)

        resp = self.client.delete(reverse(URL_NAME, args=[doc.pk]))

        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Document.objects.filter(pk=doc.pk).exists())

    def test_delete_requires_auth(self):
        doc = self._make_doc(self.pending)

        resp = self.client.delete(reverse(URL_NAME, args=[doc.pk]))

        self.assertIn(
            resp.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )
        self.assertTrue(Document.objects.filter(pk=doc.pk).exists())


@override_settings(**TEST_SETTINGS)
class AchievementDetailTests(APITestCase):
    """Карточка заявки (GET /achievements/<id>/) для страниц «Подробнее»."""

    def test_detail_exposes_semester_label(self):
        semester = make_semester(2026, "autumn", current=True)
        student = make_student("detail@uni.ru")
        doc = make_doc(student, make_catalog(), make_statuses()["pending"], semester=semester)
        self.client.force_authenticate(student)

        resp = self.client.get(reverse("api:achievements-detail", args=[doc.pk]))

        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.assertEqual(resp.data["semester_label"], "2026-2027 уч. год — осень")

    def test_detail_without_semester_has_null_label(self):
        student = make_student("legacy@uni.ru")
        doc = make_doc(student, make_catalog(), make_statuses()["pending"])
        self.client.force_authenticate(student)

        resp = self.client.get(reverse("api:achievements-detail", args=[doc.pk]))

        self.assertIsNone(resp.data["semester_label"])

    def test_detail_exposes_codes_for_edit_form(self):
        # Форма правки предзаполняет селекты по кодам справочника (/achievements/config/).
        student = make_student("codes@uni.ru")
        doc = make_doc(student, make_catalog(), make_statuses()["pending"])
        self.client.force_authenticate(student)

        resp = self.client.get(reverse("api:achievements-detail", args=[doc.pk]))

        self.assertEqual(
            {k: resp.data[k] for k in ("category_code", "sub_type_code", "level_code", "result_code", "doc_type_code")},
            {"category_code": "academic", "sub_type_code": "olympiad", "level_code": None, "result_code": None,
             "doc_type_code": "other"},
        )

