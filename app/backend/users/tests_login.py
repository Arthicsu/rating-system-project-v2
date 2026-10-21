"""
Вход: логин-почта студента без учёта регистра и лимит попыток входа с одного IP.

Почтовые сервисы регистр не различают, а username сравнивается точно - студент,
набравший почту с заглавной, не мог войти. Подбор почты ведётся только среди
активных студентов и только при однозначном совпадении.
"""
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from core.testing import DEFAULT_PASSWORD, TEST_SETTINGS, make_department, make_staff, make_student


@override_settings(**TEST_SETTINGS)
class LoginTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.url = reverse("api:auth-login")

    def _login(self, username, password=DEFAULT_PASSWORD):
        return self.client.post(self.url, {"username": username, "password": password})

    def test_login_email_case_insensitive(self):
        make_student("stud@uni.ru")

        self.assertEqual(self._login("Stud@Uni.RU").status_code, status.HTTP_200_OK)

    def test_login_ambiguous_email_fails(self):
        make_student("a@x.ru")
        make_student("A@x.ru")

        self.assertEqual(self._login("A@X.RU").status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_exact_username_wins(self):
        make_student("a@x.ru")
        make_student("A@x.ru")

        self.assertEqual(self._login("A@x.ru").status_code, status.HTTP_200_OK)

    def test_archived_email_not_resolved(self):
        make_student("arch@uni.ru", archived=True)

        self.assertEqual(self._login("Arch@uni.ru").status_code, status.HTTP_401_UNAUTHORIZED)

    def test_staff_login_by_username_unchanged(self):
        make_staff("kaf-x", "Department", department=make_department("К1"))

        self.assertEqual(self._login("kaf-x").status_code, status.HTTP_200_OK)

    def test_login_ip_throttle(self):
        # Разные логины: лимит по username (5/мин) не срабатывает, режет лимит по IP (30/мин).
        codes = [self._login(f"user{i}@uni.ru", "wrong").status_code for i in range(31)]

        self.assertNotIn(status.HTTP_429_TOO_MANY_REQUESTS, codes[:30])
        self.assertEqual(codes[30], status.HTTP_429_TOO_MANY_REQUESTS)
