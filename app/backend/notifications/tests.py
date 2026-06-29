from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from students.models import (
    Category,
    AchievementType,
    DocType,
    Document,
    DocumentStatus,
    Student,
)
from university_structure.models import Staff, Faculty, Department

User = get_user_model()

TEST_SETTINGS = {
    "CACHES": {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "notifications-tests",
        }
    },
    "PASSWORD_HASHERS": ["django.contrib.auth.hashers.MD5PasswordHasher"],
}

URL_NAME = "notifications:pending-count"


@override_settings(**TEST_SETTINGS)
class PendingCountTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.url = reverse(URL_NAME)

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
