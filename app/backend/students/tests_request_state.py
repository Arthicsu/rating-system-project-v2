"""
Причина отклонения сохраняется при повторной подаче, а список заявок сотрудника
фильтруется по состоянию (?state=new|returned|approved|rejected).

Так кафедра видит, что заявку уже отклоняли и за что (бейдж «Повторно» в кабинете),
и может смотреть отдельно новые и повторные заявки.
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
from students.models import Document
from students.services import review_document

URL = "api:achievements-list"
REASON = "Нечитаемый скан"


@override_settings(**TEST_SETTINGS)
class RequestStateTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.statuses = make_statuses()
        catalog = make_catalog()
        dept = make_department("ИТ")
        self.student = make_student("stud@uni.ru", group=make_group(dept, "ИТ-1"))
        self.staff = make_staff("kaf-it", "Department", department=dept)

        def doc(code, reason, name):
            return make_doc(self.student, catalog, self.statuses[code], achievement=name, rejection_reason=reason)

        self.new = doc("pending", "", "новая")
        self.new_null = doc("pending", None, "новая без причины")
        self.returned = doc("pending", REASON, "повторная")
        self.approved = doc("approved", "", "подтверждённая")
        self.rejected = doc("rejected", REASON, "отклонённая")

    def _ids(self, **params):
        self.client.force_authenticate(self.staff)
        resp = self.client.get(reverse(URL), params)
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        return {item["id"] for item in resp.data["results"]}

    def test_resubmitted_keeps_reason(self):
        self.client.force_authenticate(self.student)

        resp = self.client.patch(
            reverse("api:achievements-detail", args=[self.rejected.pk]), {"achievement": "исправлено"}
        )

        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.rejected.refresh_from_db()
        self.assertEqual(self.rejected.status.code, "pending")
        self.assertEqual(self.rejected.rejection_reason, REASON)

    def test_approve_clears_reason(self):
        review_document(document=self.returned, reviewer=self.staff, action="approve")

        self.returned.refresh_from_db()
        self.assertEqual(self.returned.status.code, "approved")
        self.assertFalse(self.returned.rejection_reason)

    def test_state_new(self):
        self.assertEqual(self._ids(list_type="pending", state="new"), {self.new.pk, self.new_null.pk})

    def test_state_returned(self):
        self.assertEqual(self._ids(list_type="pending", state="returned"), {self.returned.pk})

    def test_state_approved(self):
        self.assertEqual(self._ids(list_type="reviewed", state="approved"), {self.approved.pk})

    def test_state_rejected(self):
        self.assertEqual(self._ids(list_type="reviewed", state="rejected"), {self.rejected.pk})

    def test_no_state_lists_everything(self):
        self.assertEqual(
            self._ids(list_type="pending"), {self.new.pk, self.new_null.pk, self.returned.pk}
        )

    def _review(self, reviewer, doc, **body):
        self.client.force_authenticate(reviewer)
        return self.client.post(reverse("api:achievements-review", args=[doc.pk]), body)

    def test_reject_without_reason_400(self):
        # Без причины отклонённая (или возвращённая руководством) заявка выглядела бы новой,
        # а студент не узнал бы, что исправить.
        for body in ({"action": "reject"}, {"action": "reject", "reasons": []}):
            with self.subTest(body=body):
                resp = self._review(self.staff, self.new, **body)

                self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("reasons", resp.data)
                self.new.refresh_from_db()
                self.assertEqual(self.new.status.code, "pending")

    def test_department_reject_then_resubmit_is_returned(self):
        self._review(self.staff, self.new, action="reject", reasons=["Нет подписи"])
        self.client.force_authenticate(self.student)
        self.client.patch(reverse("api:achievements-detail", args=[self.new.pk]), {"achievement": "с подписью"})

        self.assertIn(self.new.pk, self._ids(list_type="pending", state="returned"))
        self.assertNotIn(self.new.pk, self._ids(list_type="pending", state="new"))

    def test_dean_return_is_returned(self):
        dean = make_staff("dean-f", "Dean", faculty=self.staff.staff_profile.department.faculty)

        resp = self._review(dean, self.approved, action="return", reasons=["Не тот семестр"])

        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.assertIn(self.approved.pk, self._ids(list_type="pending", state="returned"))

    def test_state_invalid_400(self):
        self.client.force_authenticate(self.staff)

        resp = self.client.get(reverse(URL), {"state": "bogus"})

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("state", resp.data)
