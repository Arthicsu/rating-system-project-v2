"""
Пагинация списка заявок сотрудника (/staff-profile → GET /api/v1/achievements/).

Регрессия: при одинаковом uploaded_at (пачка заявок за семестр) сортировка без
уникального добора недетерминирована, и OFFSET/LIMIT перекрывает страницы —
вторая страница показывает те же карточки, что первая.
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group as AuthGroup
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase

from students.models import (
    AchievementType,
    Category,
    DocType,
    Document,
    DocumentStatus,
    Student,
)
from university_structure.models import Staff

User = get_user_model()

TEST_SETTINGS = {
    "CACHES": {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "pagination-tests",
        }
    },
    "PASSWORD_HASHERS": ["django.contrib.auth.hashers.MD5PasswordHasher"],
}

URL_NAME = "api:achievements-list"


@override_settings(**TEST_SETTINGS)
class PendingPaginationTests(APITestCase):
    def setUp(self):
        cache.clear()

        self.approved = DocumentStatus.objects.create(code="approved", label="Подтверждено")
        self.category = Category.objects.create(code="academic", label="Учебная")
        self.sub_type = AchievementType.objects.create(
            category=self.category, code="olympiad", label="Олимпиада"
        )
        self.doc_type = DocType.objects.create(code="other", label="Другое")

        rector_group, _ = AuthGroup.objects.get_or_create(name="Rectorate")
        self.staff_user = User.objects.create_user(username="rector@uni.ru", password="pass12345")
        self.staff_user.groups.add(rector_group)
        Staff.objects.create(user=self.staff_user)

        # Четыре заявки от четырёх студентов, все с ОДНИМ uploaded_at.
        self.doc_ids = []
        for i in range(4):
            student_user = User.objects.create_user(username=f"stud{i}@uni.ru", password="pass12345")
            Student.objects.create(
                user=student_user, external_id=f"EXT-{i}", full_name=f"Студент {i}", record_book=f"RB-{i}"
            )
            doc = Document.objects.create(
                user=student_user,
                category=self.category,
                sub_type=self.sub_type,
                doc_type=self.doc_type,
                status=self.approved,
                achievement="Достижение",
            )
            self.doc_ids.append(doc.id)

        # auto_now_add проставляет разные значения; выравниваем принудительно,
        # чтобы порядок держался только на доборе -id.
        Document.objects.filter(id__in=self.doc_ids).update(uploaded_at=timezone.now())

    def _page(self, page):
        resp = self.client.get(reverse(URL_NAME), {"page_size": 2, "page": page})
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        return [r["id"] for r in resp.data["results"]]

    def test_pages_do_not_overlap_with_equal_timestamps(self):
        self.client.force_authenticate(self.staff_user)

        page1 = self._page(1)
        page2 = self._page(2)

        self.assertEqual(len(page1), 2)
        self.assertEqual(len(page2), 2)
        # Страницы не пересекаются и вместе покрывают все заявки.
        self.assertEqual(set(page1) & set(page2), set())
        self.assertEqual(set(page1) | set(page2), set(self.doc_ids))
        # Порядок детерминирован: -id при равном uploaded_at.
        self.assertEqual(page1 + page2, sorted(self.doc_ids, reverse=True))
