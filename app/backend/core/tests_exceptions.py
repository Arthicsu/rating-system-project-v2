"""
Единый формат ошибок API: текст 429 (троттлинг) - по-русски и с понятным
временем ожидания. Стандартный текст DRF наполовину английский
(«Запрос был проигнорирован. Expected available in 1652 seconds.»).
"""
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from core.exceptions import throttle_message
from core.testing import TEST_SETTINGS


class ThrottleMessageTests(APITestCase):
    def test_minutes_are_rounded_up(self):
        self.assertEqual(throttle_message(1652), "Слишком много попыток. Повторите через 28 мин.")

    def test_seconds_under_a_minute(self):
        self.assertEqual(throttle_message(42), "Слишком много попыток. Повторите через 42 с.")

    def test_unknown_wait(self):
        self.assertEqual(throttle_message(None), "Слишком много попыток. Повторите позже.")

    @override_settings(**TEST_SETTINGS)
    def test_throttled_response_is_russian(self):
        cache.clear()
        url = reverse("api:auth-forgot-password")
        for i in range(5):
            self.client.post(url, {"email": f"x{i}@uni.ru"})

        resp = self.client.post(url, {"email": "x5@uni.ru"})

        self.assertEqual(resp.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertTrue(resp.data["detail"].startswith("Слишком много попыток. Повторите через"))
        self.assertNotIn("Expected", resp.data["detail"])
        self.assertIn("Retry-After", resp)
