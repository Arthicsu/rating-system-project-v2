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
import unittest
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from students.models import (
    Category,
    AchievementType,
    DocType,
    Document,
    DocumentFile,
    DocumentStatus,
    Student,
)
from university_structure.models import Staff, Faculty, Department

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

# храним файлы в памяти.
FILE_TEST_SETTINGS = {
    **TEST_SETTINGS,
    "STORAGES": {
        "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    },
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
            reverse("api:auth-login"),
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


@unittest.skip("Саморегистрация отключена: маршрут закомментирован в users/urls.py, код сохранён намеренно")
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
        resp = self.client.get(reverse("api:auth-session"))

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
        self.url = reverse("api:auth-login")

    def test_login_success(self):
        resp = self.login("login@uni.ru")

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertEqual(data["username"], "login@uni.ru")
        self.assertTrue(data["isAuthenticated"])
        self.assertEqual(data["message"], "Успешный вход")
        check = self.client.get(reverse("api:auth-session"))
        self.assertEqual(check.status_code, status.HTTP_200_OK)

    def test_login_sets_csrf_cookie(self):
        """login() делает rotate_token → csrftoken приходит в ответе логина."""
        resp = self.login("login@uni.ru")

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("csrftoken", resp.cookies)

    def test_login_writes_audit_log(self):
        """Вход и неудачная попытка пишутся в аудит-лог (logger 'audit')."""
        with self.assertLogs("audit", level="INFO") as captured:
            self.login("login@uni.ru")
        self.assertTrue(any("login user=login@uni.ru" in line for line in captured.output))

        with self.assertLogs("audit", level="WARNING") as captured:
            self.client.post(self.url, {"username": "login@uni.ru", "password": "wrong-pass"})
        self.assertTrue(any("login_failed username=login@uni.ru" in line for line in captured.output))

    def test_login_wrong_password(self):
        resp = self.client.post(
            self.url, {"username": "login@uni.ru", "password": "wrong-pass"}
        )

        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        # Единый формат ошибок API: {"detail": "..."}
        self.assertEqual(resp.json()["detail"], "Неверный логин или пароль")

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
        self.url = reverse("api:auth-logout")

    def test_logout_requires_auth(self):
        self.assertRequiresAuth(self.url, method="post")

    def test_logout_ends_session(self):
        self.login("logout@uni.ru")

        resp = self.client.post(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        check = self.client.get(reverse("api:auth-session"))
        self.assertEqual(check.status_code, status.HTTP_200_OK)
        self.assertEqual(check.json(), {"isAuthenticated": False})


@override_settings(**TEST_SETTINGS)
class CheckAuthAPIViewTests(UsersAPITestCase):
    """GET /user/api/v1/check-auth/"""

    def setUp(self):
        super().setUp()
        self.url = reverse("api:auth-session")
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

    def test_session_response_is_not_cacheable(self):
        """
        Регресс бага «слетает сессия после F5»: браузер кэшировал ответ
        session-ручки без Cache-Control и отдавал устаревший из кэша.
        """
        resp = self.client.get(self.url)
        self.assertEqual(resp["Cache-Control"], "no-store")

        self.login("me@uni.ru")
        resp = self.client.get(self.url)
        self.assertEqual(resp["Cache-Control"], "no-store")


@override_settings(**TEST_SETTINGS)
class ApiAuthProtectionTests(UsersAPITestCase):
    """
    Все ручки API закрыты от анонимов; публичные — только login / session /
    forgot-password (регистрация отключена намеренно).
    """

    PROTECTED_GET = [
        ("api:rating-list", []),
        ("api:rating-filters", []),
        ("api:rating-export", []),
        ("api:categories-list", []),
        ("api:students-list", []),
        ("api:students-me", []),
        ("api:students-detail", [1]),
        ("api:achievements-list", []),
        ("api:achievements-detail", [1]),
        ("api:achievements-config", []),
        ("api:document-files-download", [1]),
        ("api:document-files-preview", [1]),
        ("api:staff-me", []),
        ("api:groups-list", []),
        ("api:rejection-reasons-list", []),
        ("api:academic-years-list", []),
        ("api:notifications-pending-count", []),
    ]

    PROTECTED_POST = [
        ("api:achievements-list", []),
        ("api:achievements-review", [1]),
        ("api:auth-logout", []),
    ]

    def test_protected_get_endpoints_reject_anonymous(self):
        for name, args in self.PROTECTED_GET:
            with self.subTest(endpoint=name):
                resp = self.client.get(reverse(name, args=args))
                self.assertIn(
                    resp.status_code,
                    (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
                    f"{name}: аноним получил {resp.status_code}",
                )

    def test_protected_write_endpoints_reject_anonymous(self):
        for name, args in self.PROTECTED_POST:
            with self.subTest(endpoint=name):
                resp = self.client.post(reverse(name, args=args), {})
                self.assertIn(
                    resp.status_code,
                    (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
                    f"POST {name}: аноним получил {resp.status_code}",
                )

        for method in ("patch", "delete"):
            with self.subTest(endpoint="api:achievements-detail", method=method):
                resp = getattr(self.client, method)(reverse("api:achievements-detail", args=[1]))
                self.assertIn(
                    resp.status_code,
                    (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
                )

    def test_public_endpoints_reachable_by_anonymous(self):
        # session: всегда 200 (для анонима — {"isAuthenticated": false})
        resp = self.client.get(reverse("api:auth-session"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        # login/forgot-password: аноним допущен (400 — ошибка валидации, а не отказ в доступе)
        resp = self.client.post(reverse("api:auth-login"), {})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

        resp = self.client.post(reverse("api:auth-forgot-password"), {})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


@override_settings(**TEST_SETTINGS)
class StaffEndpointsForbiddenForStudentTests(UsersAPITestCase):
    """
    Staff-ручки недоступны СТУДЕНТУ (не только анониму): роль проверяет backend
    (IsStaffProfile/CanReviewDocument), а не фронтенд. Даже увидев интерфейс
    сотрудника (остановка рендера в DevTools), студент не выполнит staff-действий.
    """

    STAFF_GET = [
        ("api:students-list", []),
        ("api:achievements-list", []),
        ("api:groups-list", []),
        ("api:rejection-reasons-list", []),
        ("api:academic-years-list", []),
        ("api:staff-me", []),
        ("api:rating-list", []),
        ("api:rating-filters", []),
        ("api:rating-export", []),
    ]

    def setUp(self):
        super().setUp()
        self.student_user = self.create_user(username="student@uni.ru")
        Student.objects.create(
            user=self.student_user, external_id="EXT-S", full_name="Студент", record_book="RB-S"
        )

    def test_staff_get_endpoints_forbidden_for_student(self):
        self.client.force_authenticate(self.student_user)
        for name, args in self.STAFF_GET:
            with self.subTest(endpoint=name):
                resp = self.client.get(reverse(name, args=args))
                self.assertEqual(
                    resp.status_code,
                    status.HTTP_403_FORBIDDEN,
                    f"{name}: студент получил {resp.status_code}",
                )

    def test_review_forbidden_for_student(self):
        self.client.force_authenticate(self.student_user)
        resp = self.client.post(
            reverse("api:achievements-review", args=[1]), {"action": "approve"}
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


@override_settings(**TEST_SETTINGS)
class StaffEndpointsRoleProtectionTests(UsersAPITestCase):
    """
    Staff-ручки закрыты от аутентифицированного СТУДЕНТА (ролевая защита,
    а не только от анонимов): 403 на каждом endpoint'е кабинета сотрудника.
    """

    STAFF_GET = [
        ("api:students-list", []),
        ("api:achievements-list", []),
        ("api:staff-me", []),
        ("api:groups-list", []),
        ("api:rejection-reasons-list", []),
        ("api:academic-years-list", []),
        ("api:rating-list", []),
        ("api:rating-filters", []),
        ("api:rating-export", []),
    ]

    def setUp(self):
        super().setUp()
        self.student_user = self.create_user(username="student@uni.ru")
        Student.objects.create(
            user=self.student_user, external_id="EXT-S1", full_name="Студент", record_book="RB-S1"
        )

    def test_staff_get_endpoints_reject_student(self):
        self.client.force_authenticate(self.student_user)
        for name, args in self.STAFF_GET:
            with self.subTest(endpoint=name):
                resp = self.client.get(reverse(name, args=args))
                self.assertEqual(
                    resp.status_code,
                    status.HTTP_403_FORBIDDEN,
                    f"{name}: студент получил {resp.status_code}, ожидали 403",
                )

    def test_review_rejects_student(self):
        self.client.force_authenticate(self.student_user)
        resp = self.client.post(
            reverse("api:achievements-review", args=[1]), {"action": "approve"}
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


@override_settings(**TEST_SETTINGS)
class ReferenceDataEndpointsTests(UsersAPITestCase):
    """GET /user/api/v1/rating-filters/ и /user/api/v1/category-achievements/"""

    def setUp(self):
        super().setUp()
        self.user = self.create_user(username="viewer@uni.ru")
        self.filters_url = reverse("api:rating-filters")
        self.categories_url = reverse("api:categories-list")

    def test_rating_filters_requires_auth(self):
        self.assertRequiresAuth(self.filters_url)

    def test_rating_filters_ok(self):
        # Фильтры рейтинга, как и сам рейтинг, доступны только сотрудникам.
        Staff.objects.create(user=self.user)
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
        # Рейтинг закрыт от студентов, смотрим от имени сотрудника.
        self.user = self.create_user(username="rating@uni.ru")
        Staff.objects.create(user=self.user)
        self.url = reverse("api:rating-list")

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


PREVIEW_URL_NAME = "api:document-files-preview"


@override_settings(**FILE_TEST_SETTINGS)
class DocumentPreviewTests(UsersAPITestCase):
    """GET /user/api/v1/document/preview/<file_id>/"""

    def setUp(self):
        super().setUp()
        self.status_obj = DocumentStatus.objects.create(code="pending", label="На рассмотрении")
        self.category = Category.objects.create(code="academic", label="Учебная")
        self.sub_type = AchievementType.objects.create(
            category=self.category, code="olympiad", label="Олимпиада"
        )
        self.doc_type = DocType.objects.create(code="other", label="Другое")

        self.user = User.objects.create_user(username="stud@uni.ru", password="pass12345")
        Student.objects.create(
            user=self.user, external_id="EXT-1", full_name="Студент", record_book="RB-1"
        )
        self.doc = Document.objects.create(
            user=self.user,
            category=self.category,
            sub_type=self.sub_type,
            doc_type=self.doc_type,
            status=self.status_obj,
            achievement="Тестовое достижение",
        )

    def _make_file(self, name, content, content_type):
        return DocumentFile.objects.create(
            document=self.doc,
            original_file_name=name,
            file=SimpleUploadedFile(name, content, content_type=content_type),
        )

    def _body(self, resp):
        return b"".join(resp.streaming_content)

    def test_pdf_is_served_inline(self):
        """PDF отдаётся как есть, но inline (для рендера в iframe)."""
        df = self._make_file("report.pdf", b"%PDF-1.4 fake", "application/pdf")
        self.client.force_authenticate(self.user)

        resp = self.client.get(reverse(PREVIEW_URL_NAME, args=[df.id]))

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp["Content-Type"], "application/pdf")
        self.assertTrue(resp["Content-Disposition"].startswith("inline;"))
        self.assertEqual(self._body(resp), b"%PDF-1.4 fake")

    def test_office_file_is_converted_to_pdf(self):
        """Офисный документ уходит в конвертер и отдаётся как inline-PDF."""
        df = self._make_file(
            "report.docx",
            b"PK\x03\x04 fake docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        self.client.force_authenticate(self.user)

        with patch("users.views.render_office_pdf", return_value=ContentFile(b"%PDF converted")) as mock_convert:
            resp = self.client.get(reverse(PREVIEW_URL_NAME, args=[df.id]))

        mock_convert.assert_called_once()
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp["Content-Type"], "application/pdf")
        self.assertIn("inline;", resp["Content-Disposition"])
        # Оригинальное имя для показа, но с расширением ".pdf".
        self.assertIn("report.pdf", resp["Content-Disposition"])
        self.assertEqual(self._body(resp), b"%PDF converted")

    def test_cache_hit_does_not_call_converter(self):
        """При попадании в кэш конвертер (Gotenberg) не дёргается."""
        from core import preview

        fake_file_obj = type("F", (), {"id": 123})()
        with patch.object(preview, "cached_pdf_exists", return_value=True), \
             patch.object(preview, "open_cached_pdf", return_value=ContentFile(b"%PDF cached")) as mock_open, \
             patch.object(preview, "convert_office_to_pdf") as mock_convert:
            result = preview.render_office_pdf(fake_file_obj)

        mock_open.assert_called_once_with(123)
        mock_convert.assert_not_called()
        self.assertEqual(result.read(), b"%PDF cached")

    def test_other_users_file_is_forbidden(self):
        """Чужой файл вне области видимости - получаем 403."""
        other = User.objects.create_user(username="other@uni.ru", password="pass12345")
        df = self._make_file("report.pdf", b"%PDF-1.4 fake", "application/pdf")
        self.client.force_authenticate(other)

        resp = self.client.get(reverse(PREVIEW_URL_NAME, args=[df.id]))

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        # Единый формат ошибок API: {"detail": "..."}
        self.assertIn("detail", resp.json())

    def test_busy_converter_returns_503_with_retry_after(self):
        """Занятый конвертер — 503 c Retry-After и {"detail": ...}."""
        from core.preview import PreviewBusyError

        df = self._make_file(
            "report.docx",
            b"PK\x03\x04 fake docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        self.client.force_authenticate(self.user)

        with patch("users.views.render_office_pdf", side_effect=PreviewBusyError):
            resp = self.client.get(reverse(PREVIEW_URL_NAME, args=[df.id]))

        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(resp["Retry-After"], "5")
        self.assertIn("detail", resp.json())

    def test_preview_requires_auth(self):
        df = self._make_file("report.pdf", b"%PDF-1.4 fake", "application/pdf")

        resp = self.client.get(reverse(PREVIEW_URL_NAME, args=[df.id]))

        self.assertIn(
            resp.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )


@override_settings(**TEST_SETTINGS)
class PendingCountTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.url = reverse("api:notifications-pending-count")

        self.approved = DocumentStatus.objects.create(code="approved", label="Подтверждено")
        self.pending = DocumentStatus.objects.create(code="pending", label="На рассмотрении")
        self.category = Category.objects.create(code="academic", label="Учебная")
        self.sub_type = AchievementType.objects.create(
            category=self.category, code="olympiad", label="Олимпиада"
        )
        self.doc_type = DocType.objects.create(code="other", label="Другое")

        self.student_user = User.objects.create_user(username="stud@uni.ru", password="pass12345")
        Student.objects.create(
            user=self.student_user, external_id="EXT-1", full_name="Студент", record_book="RB-1"
        )

    def _make_doc(self, status_obj):
        return Document.objects.create(
            user=self.student_user,
            category=self.category,
            sub_type=self.sub_type,
            doc_type=self.doc_type,
            status=status_obj,
            achievement="Тестовое достижение",
        )

    def test_requires_auth(self):
        """Аноним к IsAuthenticated + SessionAuthentication получает отказ."""
        resp = self.client.get(self.url)
        self.assertIn(
            resp.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_non_staff_gets_zero(self):
        """Студент — не сотрудник, счётчик всегда 0 (даже при наличии заявок)."""
        self._make_doc(self.pending)
        self.client.force_authenticate(self.student_user)

        resp = self.client.get(self.url)

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["pending_docs_count"], 0)

    def test_rectorate_counts_all_approved(self):
        """Ректорат видит все заявки со статусом 'approved' (глобально)."""
        self._make_doc(self.approved)
        self._make_doc(self.approved)
        self._make_doc(self.pending)  # не должна попасть в счётчик ректората

        rector = User.objects.create_user(username="rector@uni.ru", password="pass12345")
        rector.groups.add(Group.objects.create(name="Rectorate"))
        Staff.objects.create(user=rector)
        self.client.force_authenticate(rector)

        resp = self.client.get(self.url)

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["pending_docs_count"], 2)

    def _student_with_scope(self, username, faculty=None, department=None):
        user = User.objects.create_user(username=username, password="pass12345")
        Student.objects.create(
            user=user,
            external_id=f"EXT-{username}",
            full_name=username,
            record_book=f"RB-{username}",
            faculty=faculty,
            department=department,
        )
        return user

    def _doc_for(self, user, status_obj):
        return Document.objects.create(
            user=user,
            category=self.category,
            sub_type=self.sub_type,
            doc_type=self.doc_type,
            status=status_obj,
            achievement="Док",
        )

    def test_dean_counts_only_their_faculty_approved(self):
        """Декан считает 'approved' напрямую по student.faculty своего факультета."""
        fac = Faculty.objects.create(external_id="F1", name="Факультет 1", short_name="Ф1")
        other = Faculty.objects.create(external_id="F2", name="Факультет 2", short_name="Ф2")
        in_fac = self._student_with_scope("in-fac@uni.ru", faculty=fac)
        out_fac = self._student_with_scope("out-fac@uni.ru", faculty=other)
        self._doc_for(in_fac, self.approved)
        self._doc_for(in_fac, self.pending)    # не approved — не в счётчике
        self._doc_for(out_fac, self.approved)  # другой факультет — не в счётчике

        dean = User.objects.create_user(username="dean@uni.ru", password="pass12345")
        dean.groups.add(Group.objects.create(name="Dean"))
        Staff.objects.create(user=dean, faculty=fac)
        self.client.force_authenticate(dean)

        resp = self.client.get(self.url)

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["pending_docs_count"], 1)

    def test_dept_counts_only_their_department_pending(self):
        """Кафедра считает 'pending' напрямую по student.department своей кафедры."""
        fac = Faculty.objects.create(external_id="F1", name="Факультет 1", short_name="Ф1")
        dep = Department.objects.create(external_id="D1", name="Кафедра 1", short_name="К1", faculty=fac)
        other = Department.objects.create(external_id="D2", name="Кафедра 2", short_name="К2", faculty=fac)
        in_dep = self._student_with_scope("in-dep@uni.ru", department=dep)
        out_dep = self._student_with_scope("out-dep@uni.ru", department=other)
        self._doc_for(in_dep, self.pending)
        self._doc_for(in_dep, self.approved)   # не pending — не в счётчике
        self._doc_for(out_dep, self.pending)   # другая кафедра — не в счётчике

        staff_user = User.objects.create_user(username="dept@uni.ru", password="pass12345")
        staff_user.groups.add(Group.objects.create(name="Department"))
        Staff.objects.create(user=staff_user, department=dep, faculty=fac)
        self.client.force_authenticate(staff_user)

        resp = self.client.get(self.url)

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["pending_docs_count"], 1)
