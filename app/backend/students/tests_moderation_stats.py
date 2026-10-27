"""
Показатели модерации на вкладке «Статистика» (stats.moderation в списке заявок сотрудника):
сколько подано, одобрено, отклонено, ждёт решения, повторных и сколько дней ждёт самая
старая заявка — за выбранный семестр, только по студентам в области видимости.
"""
from datetime import timedelta

from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone

from rest_framework.test import APITestCase

from core.testing import (
    TEST_SETTINGS,
    make_catalog,
    make_department,
    make_doc,
    make_group,
    make_semester,
    make_staff,
    make_statuses,
    make_student,
)
from students.models import Document
from university_structure.models import AcademicYear

URL = "api:achievements-list"


@override_settings(**TEST_SETTINGS)
class ModerationStatsTests(APITestCase):
    def setUp(self):
        cache.clear()
        AcademicYear.objects.all().delete()
        self.current = make_semester(2026, "autumn", current=True)
        self.past = make_semester(2025, "spring")
        statuses = make_statuses()
        catalog = make_catalog()

        dept = make_department("ИТ")
        student = make_student("stud@uni.ru", group=make_group(dept, "ИТ-1"))
        self.staff = make_staff("kaf-it", "Department", department=dept)

        def doc(code, reason="", semester=None):
            return make_doc(
                student, catalog, statuses[code], semester=semester or self.current, rejection_reason=reason
            )

        old = doc("pending")
        Document.objects.filter(pk=old.pk).update(uploaded_at=timezone.now() - timedelta(days=10, hours=1))
        doc("pending", reason="Нет подписи")
        doc("pending", reason=None)
        doc("approved")
        doc("rejected", reason="Нечитаемый скан")
        doc("approved", semester=self.past)  # другой семестр — не считается

        # Чужая кафедра — вне области видимости.
        other = make_student("other@uni.ru", group=make_group(make_department("ФИЗ"), "Ф-1"))
        make_doc(other, catalog, statuses["pending"], semester=self.current)

    def _moderation(self, **params):
        self.client.force_authenticate(self.staff)
        resp = self.client.get(reverse(URL), params)
        self.assertEqual(resp.status_code, 200, resp.data)
        return resp.data["stats"]["moderation"]

    def test_counts_for_current_semester_in_scope(self):
        self.assertEqual(
            self._moderation(),
            {
                "submitted": 5,
                "approved": 1,
                "rejected": 1,
                "pending": 3,
                "returned": 1,
                "oldest_pending_days": 10,
            },
        )

    def test_past_semester(self):
        moderation = self._moderation(academic_year=self.past.id)

        self.assertEqual(moderation["submitted"], 1)
        self.assertEqual(moderation["approved"], 1)
        self.assertIsNone(moderation["oldest_pending_days"])

    def test_stats_ignore_list_search(self):
        # Поиск ищет карточки в списке заявок; статистика и топ-5 — по фильтрам кабинета.
        moderation = self._moderation(search="такого-нет")

        self.assertEqual(moderation["submitted"], 5)

