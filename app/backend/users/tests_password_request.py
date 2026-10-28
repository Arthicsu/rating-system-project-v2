"""
«Получить пароль» (POST /api/v1/auth/forgot-password/): первый вход и «забыл пароль»
для студентов одним сценарием.

- письмо с паролем - только активному студенту, ровно один по почте (без учёта регистра);
- архивному - письмо «аккаунт в архиве», без пароля;
- сотрудникам, несуществующим и неоднозначным почтам - ничего;
- ответ на сайте всегда один и тот же: по нему нельзя узнать, есть ли такая почта;
- кулдаун на аккаунт, чтобы почту нельзя было засыпать письмами.
"""
import re
from unittest.mock import patch

from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from core.testing import DEFAULT_PASSWORD, TEST_SETTINGS, make_department, make_staff, make_student
from users.tasks import send_archived_account_email, send_recovery_password_email


@override_settings(**TEST_SETTINGS)
@patch("users.tasks.send_archived_account_email.delay")
@patch("users.tasks.send_recovery_password_email.delay")
class PasswordRequestTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.url = reverse("api:auth-forgot-password")

    def _post(self, email):
        return self.client.post(self.url, {"email": email})

    def test_active_student_gets_password_task(self, recovery, archived):
        user = make_student("stud@uni.ru")

        resp = self._post("stud@uni.ru")

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        recovery.assert_called_once_with(user.pk)
        archived.assert_not_called()

    def test_email_lookup_case_insensitive(self, recovery, archived):
        user = make_student("stud@uni.ru")

        self._post(" Stud@Uni.RU ")

        recovery.assert_called_once_with(user.pk)

    def test_staff_email_gets_nothing(self, recovery, archived):
        staff = make_staff("kaf-x", "Department", department=make_department("К1"))
        staff.email = "kaf@uni.ru"
        staff.save(update_fields=["email"])

        resp = self._post("kaf@uni.ru")

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        recovery.assert_not_called()
        archived.assert_not_called()

    def test_unknown_email_gets_nothing_same_response(self, recovery, archived):
        make_student("stud@uni.ru")

        known = self._post("stud@uni.ru")
        cache.clear()
        unknown = self._post("nobody@uni.ru")

        self.assertEqual(known.status_code, unknown.status_code)
        self.assertEqual(
            known.data["message"].replace("stud@uni.ru", "<email>"),
            unknown.data["message"].replace("nobody@uni.ru", "<email>"),
        )
        recovery.assert_called_once()  # только для существующей почты

    def test_archived_student_gets_archive_notice(self, recovery, archived):
        user = make_student("arch@uni.ru", archived=True)

        self._post("arch@uni.ru")

        archived.assert_called_once_with(user.pk)
        recovery.assert_not_called()

    def test_cooldown_blocks_second_request(self, recovery, archived):
        make_student("stud@uni.ru")

        self._post("stud@uni.ru")
        second = self._post("stud@uni.ru")

        self.assertEqual(second.status_code, status.HTTP_200_OK)
        recovery.assert_called_once()

    def test_duplicate_email_sends_nothing(self, recovery, archived):
        make_student("a@x.ru")
        make_student("A@x.ru")  # тот же ящик: почтовые сервисы регистр не различают

        self._post("a@x.ru")

        recovery.assert_not_called()
        archived.assert_not_called()

    def test_queue_failure_still_neutral(self, recovery, archived):
        make_student("stud@uni.ru")
        recovery.side_effect = RuntimeError("broker down")

        resp = self._post("stud@uni.ru")

        # 500 только для существующей почты раскрыл бы, что аккаунт есть.
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


@override_settings(**TEST_SETTINGS, EXTERNAL_SITE_URL="https://portfolio.example")
class PasswordTasksTests(TestCase):
    def test_task_resets_password_and_mails_login(self):
        user = make_student("stud@uni.ru", password=None)

        send_recovery_password_email(user.pk)

        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ["stud@uni.ru"])
        self.assertEqual(message.subject, "Пароль для входа в Портфолио БГИТУ")
        self.assertIn("Логин: stud@uni.ru", message.body)
        self.assertIn("проигнорируйте", message.body)
        self.assertTrue(message.alternatives, "нужна HTML-версия письма")

        new_password = re.search(r"Пароль: (\S+)", message.body).group(1)
        user.refresh_from_db()
        self.assertTrue(user.check_password(new_password))

    def test_dev_redirect_gets_password_email(self):
        user = make_student("stud@uni.ru", password=None)

        with self.settings(DEBUG=True, DEV_EMAIL_REDIRECT="dev-inbox@example.test"):
            send_recovery_password_email(user.pk)

        self.assertEqual([m.to for m in mail.outbox], [["dev-inbox@example.test"]])
        self.assertIn("Логин: stud@uni.ru", mail.outbox[0].body)

    def test_task_refuses_non_student(self):
        staff = make_staff("kaf-x", "Department", department=make_department("К1"))
        staff.email = "kaf@uni.ru"
        staff.save(update_fields=["email"])

        send_recovery_password_email(staff.pk)

        self.assertEqual(mail.outbox, [])
        staff.refresh_from_db()
        self.assertTrue(staff.check_password(DEFAULT_PASSWORD))

    def test_task_refuses_archived_student(self):
        user = make_student("arch@uni.ru", archived=True)

        send_recovery_password_email(user.pk)

        self.assertEqual(mail.outbox, [])
        user.refresh_from_db()
        self.assertTrue(user.check_password(DEFAULT_PASSWORD))

    def test_archived_notice_does_not_change_password(self):
        user = make_student("arch@uni.ru", archived=True)

        send_archived_account_email(user.pk)

        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("архиве", mail.outbox[0].body)
        self.assertIn("отдел информатизации", mail.outbox[0].body)
        self.assertTrue(mail.outbox[0].body.startswith("Здравствуйте!"))  # у студента в тесте нет ФИО
        user.refresh_from_db()
        self.assertTrue(user.check_password(DEFAULT_PASSWORD))
