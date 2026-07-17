"""
Идемпотентность загрузки достижения (заголовок Idempotency-Key, core/idempotency.py).
Ревью-ручка использует тот же декоратор - отдельно не дублируется.
"""
import uuid

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from students.models import (
    AchievementType, Category, DocType, Document, DocumentStatus, ScoringRule, Student,
)

User = get_user_model()

TEST_SETTINGS = {
    # LocMemCache поддерживает атомарный cache.add - Redis для тестов не нужен.
    "CACHES": {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "idempotency-tests",
        }
    },
    "PASSWORD_HASHERS": ["django.contrib.auth.hashers.MD5PasswordHasher"],
}

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


@override_settings(**TEST_SETTINGS)
class IdempotencyTests(APITestCase):
    def setUp(self):
        cache.clear()
        DocumentStatus.objects.create(code="pending", label="На рассмотрении")
        self.category = Category.objects.create(code="academic", label="Учебная")
        self.sub_type = AchievementType.objects.create(category=self.category, code="olympiad", label="Олимпиада")
        self.doc_type = DocType.objects.create(code="other", label="Другое")
        ScoringRule.objects.create(achievement_type=self.sub_type, level=None, result=None, score=10)

        self.user = User.objects.create_user(username="stud@uni.ru", password="pass12345")
        Student.objects.create(user=self.user, external_id="EXT-1", full_name="Студент", record_book="RB-1")
        self.client.force_authenticate(self.user)

    def _upload(self, key=None, category="academic"):
        data = {
            "record_book": "RB-1",
            "category": category,
            "sub_type": "olympiad",
            "achievement": "Олимпиада",
            "doc_type": "other",
            "files": [SimpleUploadedFile("proof.png", PNG, content_type="image/png")],
        }
        headers = {"Idempotency-Key": key} if key else {}
        return self.client.post(reverse("api:achievements-list"), data=data, format="multipart", headers=headers)

    def test_same_key_second_request_conflicts(self):
        key = str(uuid.uuid4())
        self.assertEqual(self._upload(key).status_code, status.HTTP_201_CREATED)
        resp = self._upload(key)
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(Document.objects.count(), 1)

    def test_different_keys_create_two_documents(self):
        self.assertEqual(self._upload(str(uuid.uuid4())).status_code, status.HTTP_201_CREATED)
        self.assertEqual(self._upload(str(uuid.uuid4())).status_code, status.HTTP_201_CREATED)
        self.assertEqual(Document.objects.count(), 2)

    def test_without_header_behaves_as_before(self):
        self.assertEqual(self._upload().status_code, status.HTTP_201_CREATED)
        self.assertEqual(self._upload().status_code, status.HTTP_201_CREATED)
        self.assertEqual(Document.objects.count(), 2)

    def test_failed_request_frees_the_key(self):
        key = str(uuid.uuid4())
        # Невалидная категория: 400, ключ должен освободиться.
        self.assertEqual(self._upload(key, category="nope").status_code, status.HTTP_400_BAD_REQUEST)
        # Честный повтор той же отправки после исправления проходит.
        self.assertEqual(self._upload(key).status_code, status.HTTP_201_CREATED)

    def test_malformed_key_is_rejected(self):
        resp = self._upload("not-a-uuid")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Document.objects.count(), 0)

    def test_key_is_scoped_per_user(self):
        key = str(uuid.uuid4())
        self.assertEqual(self._upload(key).status_code, status.HTTP_201_CREATED)

        other = User.objects.create_user(username="stud2@uni.ru", password="pass12345")
        Student.objects.create(user=other, external_id="EXT-2", full_name="Второй", record_book="RB-2")
        self.client.force_authenticate(other)
        data_resp = self.client.post(
            reverse("api:achievements-list"),
            data={
                "record_book": "RB-2",
                "category": "academic",
                "sub_type": "olympiad",
                "achievement": "Олимпиада",
                "doc_type": "other",
                "files": [SimpleUploadedFile("proof.png", PNG, content_type="image/png")],
            },
            format="multipart",
            headers={"Idempotency-Key": key},
        )
        self.assertEqual(data_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Document.objects.count(), 2)
