"""
Письма студенту о решении по его заявке: только студенту, по умолчанию включены.

Решение сохраняется независимо от писем: письмо ставится в очередь после коммита, его сбой
не меняет ответ. Воркер перечитывает заявку и настройки студента: устаревшее решение,
отключённые письма, архивный студент — письма нет.
"""
from unittest.mock import patch

from django.core import mail
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
    make_semester,
    make_staff,
    make_statuses,
    make_student,
)
from students.services import credit_document
from students.tasks import send_review_decision_email
from university_structure.models import AcademicYear

REVIEW = "api:achievements-review"
NOTIFICATIONS = "api:auth-notifications"
SITE = "https://portfolio.example"
TITLE = "Диплом олимпиады по физике"
REASON = "Нет подписи"
DEV_INBOX = "dev-inbox@example.test"


@override_settings(**TEST_SETTINGS, EXTERNAL_SITE_URL=SITE)
class DecisionEmailTests(APITestCase):
    def setUp(self):
        cache.clear()
        AcademicYear.objects.all().delete()
        self.semester = make_semester(2026, "autumn", current=True)
        self.statuses = make_statuses()
        self.catalog = make_catalog()
        dept = make_department("ИТ")
        self.group = make_group(dept, "ИТ-1")
        self.student = make_student("stud@uni.ru", group=self.group)
        self.department = make_staff("kaf-it", "Department", department=dept)
        self.dean = make_staff("dean-it", "Dean", faculty=dept.faculty)

    def _doc(self, code, user=None):
        doc = make_doc(user or self.student, self.catalog, self.statuses[code], semester=self.semester, achievement=TITLE)
        if code == "approved":
            credit_document(doc)
        return doc

    def _review(self, reviewer, doc, action):
        self.client.force_authenticate(reviewer)
        with self.captureOnCommitCallbacks(execute=True):
            resp = self.client.post(reverse(REVIEW, args=[doc.public_id]), {"action": action, "reasons": [REASON]})
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        return resp

    def test_approve_emails_student(self):
        doc = self._doc("pending")

        self._review(self.department, doc, "approve")

        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ["stud@uni.ru"])
        self.assertEqual(message.subject, "Портфолио БГИТУ: решение по заявке")
        self.assertIn(TITLE, message.body)
        self.assertIn("одобрена", message.body)
        self.assertIn(f"{SITE}/achievement/{doc.public_id}", message.body)
        self.assertIn(f"{SITE}/settings", message.body)
        self.assertNotIn(REASON, message.body)
        self.assertTrue(message.alternatives, "нужна HTML-версия письма")

    def test_reject_email_has_reason(self):
        doc = self._doc("pending")

        self._review(self.department, doc, "reject")

        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("отклонена", mail.outbox[0].body)
        self.assertIn(f"Причина: {REASON}", mail.outbox[0].body)

    def test_return_email_says_rechecked(self):
        doc = self._doc("approved")

        self._review(self.dean, doc, "return")

        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("повторную проверку", mail.outbox[0].body)
        self.assertIn(REASON, mail.outbox[0].body)

    def test_no_staff_data_in_email(self):
        doc = self._doc("pending")

        self._review(self.department, doc, "approve")

        self.assertNotIn("kaf-it", mail.outbox[0].body)

    def test_opted_out_student_gets_no_email(self):
        self.student.notify_review_emails = False
        self.student.save(update_fields=["notify_review_emails"])
        doc = self._doc("approved")

        send_review_decision_email(doc.pk, "approved")

        self.assertEqual(mail.outbox, [])

    def test_archived_student_gets_no_email(self):
        archived = make_student("old@uni.ru", group=self.group, archived=True)
        doc = self._doc("approved", user=archived)

        send_review_decision_email(doc.pk, "approved")

        self.assertEqual(mail.outbox, [])

    def test_student_without_email_gets_none(self):
        no_mail = make_student("nomail", group=self.group, email="")
        doc = self._doc("approved", user=no_mail)

        send_review_decision_email(doc.pk, "approved")

        self.assertEqual(mail.outbox, [])

    def test_superseded_decision_sends_nothing(self):
        # Письмо ждало в очереди, а решение уже другое: о новом уйдёт своё письмо.
        doc = self._doc("rejected")

        send_review_decision_email(doc.pk, "approved")

        self.assertEqual(mail.outbox, [])

    def test_deleted_document_sends_nothing(self):
        doc = self._doc("approved")
        doc_id = doc.pk
        doc.delete()

        send_review_decision_email(doc_id, "approved")

        self.assertEqual(mail.outbox, [])

    @patch("students.tasks.send_review_decision_email.delay", side_effect=RuntimeError("broker down"))
    def test_queue_failure_keeps_decision(self, _queued):
        doc = self._doc("pending")

        self._review(self.department, doc, "approve")

        doc.refresh_from_db()
        self.assertEqual(doc.status.code, "approved")

    @patch("students.tasks.send_review_decision_email.delay")
    def test_email_queued_only_after_commit(self, queued):
        doc = self._doc("pending")
        self.client.force_authenticate(self.department)

        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            self.client.post(reverse(REVIEW, args=[doc.public_id]), {"action": "approve"})
            queued.assert_not_called()

        for callback in callbacks:
            callback()
        queued.assert_called_once_with(doc.pk, "approved")

    def test_dev_sends_only_to_test_accounts(self):
        # dev-база — копия реальных студентов: при DEBUG письма уходят только test_*-учёткам.
        real = self._doc("approved")
        tester = make_student("test_student@bgitu.test", group=self.group)
        test_doc = self._doc("approved", user=tester)

        with self.settings(DEBUG=True):
            send_review_decision_email(real.pk, "approved")
            send_review_decision_email(test_doc.pk, "approved")

        self.assertEqual([m.to for m in mail.outbox], [["test_student@bgitu.test"]])

    def test_dev_redirect_gets_every_decision(self):
        # С DEV_EMAIL_REDIRECT письма dev-стенда уходят в один ящик, студентам - никогда.
        real = self._doc("approved")
        tester = make_student("test_student@bgitu.test", group=self.group)
        test_doc = self._doc("approved", user=tester)

        with self.settings(DEBUG=True, DEV_EMAIL_REDIRECT=DEV_INBOX):
            send_review_decision_email(real.pk, "approved")
            send_review_decision_email(test_doc.pk, "approved")

        self.assertEqual([m.to for m in mail.outbox], [[DEV_INBOX], [DEV_INBOX]])

    def test_redirect_ignored_without_debug(self):
        doc = self._doc("approved")

        with self.settings(DEBUG=False, DEV_EMAIL_REDIRECT=DEV_INBOX):
            send_review_decision_email(doc.pk, "approved")

        self.assertEqual([m.to for m in mail.outbox], [["stud@uni.ru"]])


@override_settings(**TEST_SETTINGS)
class NotificationSettingsApiTests(APITestCase):
    def setUp(self):
        self.student = make_student("stud@uni.ru")
        self.staff = make_staff("kaf-it", "Department")

    def test_emails_on_by_default_and_in_session(self):
        self.client.force_authenticate(self.student)

        resp = self.client.get(reverse("api:auth-session"))

        self.assertIs(resp.data["notify_review_emails"], True)

    def test_student_turns_emails_off(self):
        self.client.force_authenticate(self.student)

        resp = self.client.put(reverse(NOTIFICATIONS), {"notify_review_emails": False})

        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.assertEqual(resp.data, {"notify_review_emails": False})
        self.student.refresh_from_db()
        self.assertFalse(self.student.notify_review_emails)

    def test_value_required(self):
        self.client.force_authenticate(self.student)

        resp = self.client.put(reverse(NOTIFICATIONS), {})

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.student.refresh_from_db()
        self.assertTrue(self.student.notify_review_emails)

    def test_only_this_field_changes(self):
        self.client.force_authenticate(self.student)

        self.client.put(reverse(NOTIFICATIONS), {"notify_review_emails": False, "email": "evil@x.ru", "is_staff": True})

        self.student.refresh_from_db()
        self.assertEqual(self.student.email, "stud@uni.ru")
        self.assertFalse(self.student.is_staff)

    def test_staff_and_anonymous_forbidden(self):
        for user in (self.staff, None):
            with self.subTest(user=user):
                self.client.force_authenticate(user)

                resp = self.client.put(reverse(NOTIFICATIONS), {"notify_review_emails": False})

                self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
