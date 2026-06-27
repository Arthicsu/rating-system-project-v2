"""
Тесты API-ручек приложения `users`.

Покрывают публичный контракт эндпоинтов (статус-коды, тело ответа, проверки доступа и сквозной сценарий сессии регистрация → вход → проверка → выход).
задача - убедиться, что после сборки прод-версии все ручки отвечают корректно.

Запуск:
    python manage.py test users # локально / в CI
    python manage.py test users --keepdb # быстрее при повторных прогонах
    docker compose exec backend python manage.py test users # внутри контейнера

Важно про окружение тестов:
- В проекте сессии хранятся в кэше (SESSION_ENGINE = ...cache), а кэш - Redis, плюс на части ручек висит @cache_page.
  Чтобы тесты не зависели от живого Redis и не загрязняли его, кэш переопределяется на locmem (TEST_SETTINGS) и чистится перед каждым тестом. 
  Сессии при этом тоже ложатся в locmem и переживают несколько запросов одного теста - это и позволяет проверять вход/выход сквозь реальные cookie.
- `manage.py test` создаёт отдельную тестовую БД, поэтому прод-данные не затрагиваются.
Пользователь БД должен иметь право CREATE DATABASE  (у стандартного postgres-пользователя из compose оно есть).
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from students.models import Student

User = get_user_model()

# локальный кэш (он же бэкенд сессий) + быстрый хешер паролей.
TEST_SETTINGS = {
    "CACHES": {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "users-tests",
        }
    },
    "PASSWORD_HASHERS": ["django.contrib.auth.hashers.MD5PasswordHasher"],
}

DEFAULT_PASSWORD = "StrongPass123"


class UsersAPITestCase(APITestCase):
    """Базовый класс: общие хелперы и изоляция кэша между тестами."""

    def setUp(self):
        super().setUp()
        # cache_page и кэш-сессии живут в одном locmem - чистим, чтобы тесты не влияли друг на друга
        cache.clear()

    def create_user(self, username="user@uni.ru", password=DEFAULT_PASSWORD, **extra):
        return User.objects.create_user(username=username, password=password, **extra)

    def login(self, username, password=DEFAULT_PASSWORD):
        """Реальный вход через ручку логина (ставит сессионную cookie на клиента)."""
        return self.client.post(
            reverse("user:api_login"),
            {"username": username, "password": password},
        )

    def assertRequiresAuth(self, url, method="get", **kwargs):
        """Анонимный запрос к защищённой ручке должен отклоняться (401/403)."""
        resp = getattr(self.client, method)(url, **kwargs)
        self.assertIn(
            resp.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
            f"{method.upper()} {url}: ожидали отказ анониму, получили {resp.status_code}",
        )
        return resp


@override_settings(**TEST_SETTINGS)
class RegistrationAPIViewTests(UsersAPITestCase):
    """POST /user/api/v1/register/student/"""

    def setUp(self):
        super().setUp()
        # Регистрация добавляет пользователя в группу Student
        Group.objects.get_or_create(name="Student")
        self.url = reverse("user:api_register_student")
        self.payload = {
            "first_name": "Иван",
            "last_name": "Иванов",
            "patronymic": "Иванович",
            "email": "ivanov@uni.ru",
            "password": DEFAULT_PASSWORD,
            "record_book": "RB-001",
        }

    def test_registration_success(self):
        resp = self.client.post(self.url, self.payload)

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        data = resp.json()
        self.assertEqual(data["username"], "ivanov@uni.ru")
        self.assertEqual(data["record_book"], "RB-001")
        self.assertTrue(data["isAuthenticated"])
        self.assertIn("Student", data["roles"])
        self.assertEqual(data["message"], "Регистрация успешна")
        self.assertNotIn("password", data)

        # Созданы и пользователь, и связанный профиль студента
        self.assertTrue(User.objects.filter(username="ivanov@uni.ru").exists())
        self.assertTrue(Student.objects.filter(record_book="RB-001").exists())

    def test_registration_auto_login(self):
        self.client.post(self.url, self.payload)
        resp = self.client.get(reverse("user:api_check_auth"))

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json()["username"], "ivanov@uni.ru")

    def test_duplicate_email_rejected(self):
        self.client.post(self.url, self.payload)
        resp = self.client.post(self.url, {**self.payload, "record_book": "RB-002"})

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", resp.json())

    def test_duplicate_record_book_rejected(self):
        self.client.post(self.url, self.payload)
        resp = self.client.post(self.url, {**self.payload, "email": "other@uni.ru"})

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("record_book", resp.json())

    def test_missing_required_fields_rejected(self):
        resp = self.client.post(self.url, {"email": "x@uni.ru"})

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


@override_settings(**TEST_SETTINGS)
class LoginAPIViewTests(UsersAPITestCase):
    """POST /user/api/v1/login/"""

    def setUp(self):
        super().setUp()
        self.user = self.create_user(
            username="login@uni.ru", first_name="Пётр", last_name="Петров"
        )
        self.url = reverse("user:api_login")

    def test_login_success(self):
        resp = self.login("login@uni.ru")

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data["username"], "login@uni.ru")
        self.assertTrue(data["isAuthenticated"])
        self.assertEqual(data["message"], "Успешный вход")
        check = self.client.get(reverse("user:api_check_auth"))
        self.assertEqual(check.status_code, status.HTTP_200_OK)

    def test_login_wrong_password(self):
        resp = self.client.post(
            self.url, {"username": "login@uni.ru", "password": "wrong-pass"}
        )

        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_unknown_user(self):
        resp = self.client.post(
            self.url, {"username": "ghost@uni.ru", "password": DEFAULT_PASSWORD}
        )

        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_missing_fields_rejected(self):
        resp = self.client.post(self.url, {"username": "login@uni.ru"})

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


@override_settings(**TEST_SETTINGS)
class LogoutAPIViewTests(UsersAPITestCase):
    """POST /user/api/v1/logout/"""

    def setUp(self):
        super().setUp()
        self.user = self.create_user(username="logout@uni.ru")
        self.url = reverse("user:api_logout")

    def test_logout_requires_auth(self):
        self.assertRequiresAuth(self.url, method="post")

    def test_logout_ends_session(self):
        self.login("logout@uni.ru")

        resp = self.client.post(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        check = self.client.get(reverse("user:api_check_auth"))
        self.assertEqual(check.status_code, status.HTTP_200_OK)
        self.assertEqual(check.json(), {"isAuthenticated": False})


@override_settings(**TEST_SETTINGS)
class CheckAuthAPIViewTests(UsersAPITestCase):
    """GET /user/api/v1/check-auth/"""

    def setUp(self):
        super().setUp()
        self.url = reverse("user:api_check_auth")
        self.user = self.create_user(
            username="me@uni.ru", first_name="Анна", last_name="Сидорова"
        )

    def test_anonymous_returns_200_with_flag(self):
        resp = self.client.get(self.url)

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.json(), {"isAuthenticated": False})

    def test_authenticated_returns_user(self):
        self.login("me@uni.ru")
        resp = self.client.get(self.url)

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data["username"], "me@uni.ru")
        self.assertTrue(data["isAuthenticated"])
        # Контракт UserResponseSerializer
        for field in ("id", "is_staff", "full_name", "short_name", "roles"):
            self.assertIn(field, data)


@override_settings(**TEST_SETTINGS)
class ReferenceDataEndpointsTests(UsersAPITestCase):
    """GET /user/api/v1/rating-filters/ и /user/api/v1/category-achievements/"""

    def setUp(self):
        super().setUp()
        self.user = self.create_user(username="viewer@uni.ru")
        self.filters_url = reverse("user:api_student_rating_filters")
        self.categories_url = reverse("user:api_category_achievements")

    def test_rating_filters_requires_auth(self):
        self.assertRequiresAuth(self.filters_url)

    def test_rating_filters_ok(self):
        self.client.force_authenticate(self.user)
        resp = self.client.get(self.filters_url)

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        for key in ("faculties", "courses", "groups"):
            self.assertIn(key, data)

    def test_categories_requires_auth(self):
        self.assertRequiresAuth(self.categories_url)

    def test_categories_ok(self):
        self.client.force_authenticate(self.user)
        resp = self.client.get(self.categories_url)

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # Пагинация на этой ручке отключена - отдаётся плоский список
        self.assertIsInstance(resp.json(), list)


@override_settings(**TEST_SETTINGS)
class RatingListAPIViewTests(UsersAPITestCase):
    """GET /user/api/v2/rating/"""

    def setUp(self):
        super().setUp()
        self.user = self.create_user(username="rating@uni.ru")
        self.url = reverse("user:api_v2_student_rating")

    def test_requires_auth(self):
        self.assertRequiresAuth(self.url)

    def test_authenticated_returns_paginated(self):
        self.client.force_authenticate(self.user)
        resp = self.client.get(self.url)

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        for key in ("count", "results"):
            self.assertIn(key, data)
        self.assertIsInstance(data["results"], list)
