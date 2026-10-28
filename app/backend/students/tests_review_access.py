"""
Граница доступа страницы заявки сотрудника (/staff-profile/requests/<id>, спек 1д):
модерация и карточка — только в области видимости; студент не модерирует даже свою заявку.
Фронт-guard лишь прячет интерфейс, защищает бэкенд — эти тесты это фиксируют.
"""
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from core.testing import (
    TEST_SETTINGS,
    make_catalog,
    make_department,
    make_doc,
    make_group,
    make_staff,
    make_statuses,
    make_student,
)
from students.services import review_document

REVIEW = "api:achievements-review"
DETAIL = "api:achievements-detail"


@override_settings(**TEST_SETTINGS)
class ReviewAccessTests(APITestCase):
    def setUp(self):
        cache.clear()
        statuses = make_statuses()
        catalog = make_catalog()
        dept = make_department("ИТ")
        self.student = make_student("stud@uni.ru", group=make_group(dept, "ИТ-1"))
        self.staff = make_staff("kaf-it", "Department", department=dept)
        self.dean = make_staff("dean-it", "Dean", faculty=dept.faculty)
        self.foreign = make_staff("kaf-fiz", "Department", department=make_department("ФИЗ"))
        self.pending = make_doc(self.student, catalog, statuses["pending"])
        self.approved = make_doc(self.student, catalog, statuses["approved"])

    def test_student_cannot_review_own_doc(self):
        self.client.force_authenticate(self.student)

        resp = self.client.post(reverse(REVIEW, args=[self.pending.public_id]), {"action": "approve"})

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_foreign_department_cannot_review(self):
        self.client.force_authenticate(self.foreign)

        resp = self.client.post(reverse(REVIEW, args=[self.pending.public_id]), {"action": "approve"})

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_foreign_department_cannot_retrieve(self):
        self.client.force_authenticate(self.foreign)

        resp = self.client.get(reverse(DETAIL, args=[self.pending.public_id]))

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_detail_shows_who_returned(self):
        # Страница заявки сотрудника пишет «Возвращена деканатом», а не «Ранее отклонялась».
        review_document(document=self.approved, reviewer=self.dean, action="return", reasons=["Проверьте уровень"])
        self.client.force_authenticate(self.staff)

        resp = self.client.get(reverse(DETAIL, args=[self.approved.public_id]))

        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.assertEqual(resp.data["returned_by"], "Dean")
