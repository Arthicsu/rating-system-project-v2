"""
Рейтинг (вкладка «Студенты» кабинета) и его Excel-выгрузка ограничены областью
видимости сотрудника: кафедра - своя кафедра, декан - свой факультет, ректорат - все.

Раньше rating_queryset scope не применял, и кафедра видела весь вуз (профили чужих
при этом не открывались - HasStudentScope отвечал 403).
"""
import io
import zipfile

from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from core.testing import DEFAULT_PASSWORD, TEST_SETTINGS, make_department, make_group, make_staff, make_student


@override_settings(**TEST_SETTINGS)
class RatingScopeTests(APITestCase):
    def setUp(self):
        cache.clear()
        dep_a = make_department("A")
        dep_b = make_department("B", faculty=dep_a.faculty)
        dep_c = make_department("C")  # другой факультет

        make_student("stud-a", group=make_group(dep_a, "GA"))
        make_student("stud-b", group=make_group(dep_b, "GB"))
        make_student("stud-c", group=make_group(dep_c, "GC"))

        self.dept_a = make_staff("dept-a", "Department", department=dep_a)
        self.dept_b = make_staff("dept-b", "Department", department=dep_b)
        self.dean = make_staff("dean", "Dean", faculty=dep_a.faculty)
        self.rector = make_staff("rector", "Rectorate")
        self.url = reverse("api:rating-list")

    def _names(self, user):
        self.client.force_authenticate(user)
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        return sorted(row["full_name"] for row in resp.data["results"])

    def test_dept_sees_only_own_department(self):
        self.assertEqual(self._names(self.dept_a), ["stud-a"])

    def test_dean_sees_only_own_faculty(self):
        self.assertEqual(self._names(self.dean), ["stud-a", "stud-b"])

    def test_rectorate_sees_all(self):
        self.assertEqual(self._names(self.rector), ["stud-a", "stud-b", "stud-c"])

    def test_export_respects_scope(self):
        self.client.force_authenticate(self.dept_a)
        resp = self.client.get(reverse("api:rating-export"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
            shared = zf.read("xl/sharedStrings.xml").decode("utf-8")
        self.assertIn("stud-a", shared)
        self.assertNotIn("stud-b", shared)
        self.assertNotIn("stud-c", shared)

    def test_cached_list_not_shared_between_departments(self):
        # Реальный вход (cookie-сессии): cache_page с vary_on_headers('Cookie') не должен
        # отдать кафедре B закэшированный ответ кафедры A по тому же URL.
        client_a, client_b = APIClient(), APIClient()
        for client, username in ((client_a, "dept-a"), (client_b, "dept-b")):
            login = client.post(reverse("api:auth-login"), {"username": username, "password": DEFAULT_PASSWORD})
            self.assertEqual(login.status_code, status.HTTP_200_OK)

        names_a = [r["full_name"] for r in client_a.get(self.url).data["results"]]
        names_b = [r["full_name"] for r in client_b.get(self.url).data["results"]]

        self.assertEqual(names_a, ["stud-a"])
        self.assertEqual(names_b, ["stud-b"])
