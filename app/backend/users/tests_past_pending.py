"""
Заявки прошлых учебных лет, которые так и не рассмотрела кафедра: счётчик в pending-count
(past_pending) по годам, в scope сотрудника. Кабинет по нему показывает заметку с переходом.
"""
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse

from rest_framework.test import APITestCase

from core.testing import (
    TEST_SETTINGS, make_catalog, make_department, make_doc, make_group, make_semester, make_staff,
    make_statuses, make_student,
)

URL = "api:notifications-pending-count"


@override_settings(**TEST_SETTINGS)
class PastPendingTests(APITestCase):
    def setUp(self):
        cache.clear()
        statuses, catalog = make_statuses(), make_catalog()
        self.department = make_department("К1")
        mine = make_student("mine@uni.ru", group=make_group(self.department, "ИВТ-101"))
        other = make_student("other@uni.ru", group=make_group(make_department("К2"), "ПИ-101"))
        old = make_semester(2023, "spring")
        past = make_semester(2024, "autumn")
        current = make_semester(2025, "autumn", current=True)
        for semester in (old, past, past, current):
            make_doc(mine, catalog, statuses["pending"], semester=semester)
        make_doc(mine, catalog, statuses["approved"], semester=past)
        make_doc(other, catalog, statuses["pending"], semester=past)

    def test_past_pending_counts_old_years_in_scope(self):
        self.client.force_authenticate(make_staff("kaf", "Department", department=self.department))

        data = self.client.get(reverse(URL)).data

        self.assertEqual(data["pending_docs_count"], 1)
        self.assertEqual(data["past_pending"], [
            {"year_start": 2024, "label": "2024-2025 уч. год", "count": 2},
            {"year_start": 2023, "label": "2023-2024 уч. год", "count": 1},
        ])

    def test_past_pending_empty_for_leadership(self):
        # Руководство не решает по новым заявкам (решает кафедра) - заметка ему не нужна.
        self.client.force_authenticate(make_staff("rector", "Rectorate"))

        self.assertEqual(self.client.get(reverse(URL)).data["past_pending"], [])

    def test_past_pending_empty_for_student(self):
        self.client.force_authenticate(make_student("s@uni.ru"))

        self.assertEqual(self.client.get(reverse(URL)).data["past_pending"], [])
