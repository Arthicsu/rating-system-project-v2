"""
Смена пароля студентом (POST /api/v1/auth/change-password/).

Студент заменяет пароль из письма на свой - письмо с паролем в ящике перестаёт быть
опасным. Нужен текущий пароль; новый проходит AUTH_PASSWORD_VALIDATORS. Текущая сессия
живёт, остальные сессии гаснут; на почту уходит уведомление. Сотрудникам смены пароля
нет: их общими учётками управляет ОИ.
"""
from unittest.mock import patch

from django.conf import settings
from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from core.testing import DEFAULT_PASSWORD, TEST_SETTINGS, make_department, make_staff, make_student
from university_structure.models import Staff
from users.tasks import send_password_changed_email

NEW_PASSWORD = "Novyj-parol-2026"


def _login(client, username, password=DEFAULT_PASSWORD):
    return client.post(reverse("api:auth-login"), {"username": username, "password": password})


def _is_authenticated(client):
    return client.get(reverse("api:auth-session")).data["isAuthenticated"]


@override_settings(**TEST_SETTINGS)
@patch("users.tasks.send_password_changed_email.delay")
class ChangePasswordTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.url = reverse("api:auth-change-password")
        self.user = make_student("stud@uni.ru")
        _login(self.client, "stud@uni.ru")

    def _change(self, old=DEFAULT_PASSWORD, new=NEW_PASSWORD, client=None):
        return (client or self.client).post(self.url, {"old_password": old, "new_password": new})

    def _password_is(self, password):
        self.user.refresh_from_db()
        return self.user.check_password(password)

    def test_wrong_old_password_400(self, queued):
        resp = self._change(old="wrong-pass-1")

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data["old_password"], ["Неверный текущий пароль"])
        self.assertTrue(self._password_is(DEFAULT_PASSWORD))
        queued.assert_not_called()

    def test_weak_new_password_400(self, queued):
        resp = self._change(new="12345678")

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password", resp.data)
        self.assertTrue(self._password_is(DEFAULT_PASSWORD))

    def test_same_password_400(self, queued):
        resp = self._change(new=DEFAULT_PASSWORD)

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password", resp.data)

    def test_staff_403(self, queued):
        staff_client = APIClient()
        make_staff("kaf-x", "Department", department=make_department("К1"))
        _login(staff_client, "kaf-x")

        resp = self._change(client=staff_client)

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_student_with_staff_profile_403(self, queued):
        # Фронт считает такую учётку сотрудником (is_employee), а паролями сотрудников управляет ОИ.
        Staff.objects.create(user=self.user)

        resp = self._change()

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(self._password_is(DEFAULT_PASSWORD))

    def test_csrf_required(self, queued):
        client = APIClient(enforce_csrf_checks=True)
        _login(client, "stud@uni.ru")

        resp = self._change(client=client)

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(self._password_is(DEFAULT_PASSWORD))

    def test_anonymous_403(self, queued):
        resp = self._change(client=APIClient())

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(self._password_is(DEFAULT_PASSWORD))

    def test_change_password_keeps_current_session_kills_others(self, queued):
        other = APIClient()
        _login(other, "stud@uni.ru")
        self.assertTrue(_is_authenticated(other))
        session_key = self.client.cookies[settings.SESSION_COOKIE_NAME].value

        resp = self._change()

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["message"], "Пароль изменён")
        self.assertTrue(_is_authenticated(self.client))
        self.assertFalse(_is_authenticated(other))
        # Ключ текущей сессии тоже меняется - старый, если утёк, уже не годится.
        self.assertNotEqual(self.client.cookies[settings.SESSION_COOKIE_NAME].value, session_key)

    def test_new_password_works_old_fails(self, queued):
        self._change()

        self.assertEqual(_login(APIClient(), "stud@uni.ru").status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(_login(APIClient(), "stud@uni.ru", NEW_PASSWORD).status_code, status.HTTP_200_OK)

    def test_password_with_spaces_logs_in_as_typed(self, queued):
        # Вход обрезает пробелы по краям пароля - смена должна сохранять так же, иначе блокировка.
        self._change(new=f" {NEW_PASSWORD} ")

        self.assertEqual(
            _login(APIClient(), "stud@uni.ru", f" {NEW_PASSWORD} ").status_code, status.HTTP_200_OK
        )

    def test_sixth_request_429(self, queued):
        codes = [self._change(old="wrong-pass-1").status_code for _ in range(6)]

        self.assertEqual(codes[:5], [status.HTTP_400_BAD_REQUEST] * 5)
        self.assertEqual(codes[5], status.HTTP_429_TOO_MANY_REQUESTS)

    def test_throttle_is_per_user(self, queued):
        # Лимит считается по учётке, а не по IP: соседи по компьютерному классу друг друга не блокируют.
        for _ in range(5):
            self._change(old="wrong-pass-1")
        neighbour = APIClient()
        make_student("other@uni.ru")
        _login(neighbour, "other@uni.ru")

        resp = neighbour.post(self.url, {"old_password": DEFAULT_PASSWORD, "new_password": NEW_PASSWORD})

        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_wrong_old_password_is_audited(self, queued):
        # Подбор текущего пароля из чужой сессии должен оставлять след в журнале.
        with self.assertLogs("audit", level="WARNING") as logs:
            self._change(old="guess-pass-1")

        record = "\n".join(logs.output)
        self.assertIn(f"password change failed: wrong current password user={self.user.pk}", record)
        self.assertIn("ip=", record)
        self.assertNotIn("guess-pass-1", record)

    def test_changed_email_task_queued(self, queued):
        self._change()

        queued.assert_called_once_with(self.user.pk)

    def test_queue_failure_still_changes_password(self, queued):
        # Пароль уже сменён - падение очереди писем не должно превращаться в 500.
        queued.side_effect = RuntimeError("broker down")

        resp = self._change()

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(self._password_is(NEW_PASSWORD))

    def test_audit_log_has_no_passwords(self, queued):
        with self.assertLogs("audit", level="INFO") as logs:
            self._change()

        record = "\n".join(logs.output)
        self.assertIn(f"password changed user={self.user.pk}", record)
        self.assertNotIn(NEW_PASSWORD, record)
        self.assertNotIn(DEFAULT_PASSWORD, record)


@override_settings(**TEST_SETTINGS, EXTERNAL_SITE_URL="https://portfolio.example")
class PasswordChangedEmailTests(TestCase):
    def test_notice_sent_without_password(self):
        user = make_student("stud@uni.ru")

        send_password_changed_email(user.pk)

        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ["stud@uni.ru"])
        self.assertEqual(message.subject, "Портфолио БГИТУ: пароль изменён")
        self.assertIn("Пароль от Портфолио БГИТУ изменён", message.body)
        self.assertIn("Если это были не вы", message.body)
        self.assertIn("https://portfolio.example", message.body)
        self.assertNotIn(DEFAULT_PASSWORD, message.body)
        self.assertTrue(message.alternatives, "нужна HTML-версия письма")

    def test_no_email_no_letter(self):
        user = make_student("stud@uni.ru", email="")

        send_password_changed_email(user.pk)

        self.assertEqual(mail.outbox, [])
