"""
Заявка, профиль студента и файл заявки открываются по UUID, а не по номеру из базы: по номерам
нельзя перебрать чужие заявки и профили и понять, сколько их и в каком порядке подавались.
Номера этих записей и номера учёток не уходят наружу ни в адресах, ни в ответах API.
"""
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from core.testing import (
    FILE_TEST_SETTINGS,
    make_catalog,
    make_department,
    make_doc,
    make_group,
    make_semester,
    make_staff,
    make_statuses,
    make_student,
)
from students.models import DocumentFile
from university_structure.models import AcademicYear

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


@override_settings(**FILE_TEST_SETTINGS)
class PublicIdTests(APITestCase):
    def setUp(self):
        cache.clear()
        AcademicYear.objects.all().delete()
        semester = make_semester(2026, "autumn", current=True)
        dept = make_department("ИТ")
        self.user = make_student("stud@uni.ru", group=make_group(dept, "ИТ-1"))
        self.student = self.user.student_profile
        self.doc = make_doc(self.user, make_catalog(), make_statuses()["pending"], semester=semester)
        self.file = DocumentFile.objects.create(
            document=self.doc, original_file_name="a.png",
            file=SimpleUploadedFile("a.png", PNG, content_type="image/png"),
        )
        self.staff = make_staff("kaf-it", "Department", department=dept)

    def test_request_opens_by_uuid_not_number(self):
        self.client.force_authenticate(self.user)

        by_uuid = self.client.get(f"/api/v1/achievements/{self.doc.public_id}/")
        by_number = self.client.get(f"/api/v1/achievements/{self.doc.pk}/")

        self.assertEqual(by_uuid.status_code, status.HTTP_200_OK)
        self.assertEqual(by_uuid.json()["id"], str(self.doc.public_id))
        self.assertEqual(by_number.status_code, status.HTTP_404_NOT_FOUND)

    def test_student_profile_opens_by_uuid_not_number(self):
        self.client.force_authenticate(self.staff)

        by_uuid = self.client.get(f"/api/v1/students/{self.student.public_id}/")
        by_number = self.client.get(f"/api/v1/students/{self.student.pk}/")

        self.assertEqual(by_uuid.status_code, status.HTTP_200_OK)
        self.assertEqual(by_uuid.json()["id"], str(self.student.public_id))
        self.assertEqual(by_number.status_code, status.HTTP_404_NOT_FOUND)

    def test_file_opens_by_uuid_not_number(self):
        self.client.force_authenticate(self.user)

        by_uuid = self.client.get(f"/api/v1/document-files/{self.file.public_id}/preview/")
        by_number = self.client.get(f"/api/v1/document-files/{self.file.pk}/preview/")

        self.assertEqual(by_uuid.status_code, status.HTTP_200_OK)
        self.assertEqual(by_number.status_code, status.HTTP_404_NOT_FOUND)

    def test_staff_lists_carry_uuids(self):
        self.client.force_authenticate(self.staff)

        requests = self.client.get(reverse("api:achievements-list")).json()
        students = self.client.get(reverse("api:students-list")).json()
        rating = self.client.get(reverse("api:rating-list")).json()

        doc_id, student_id, file_id = str(self.doc.public_id), str(self.student.public_id), str(self.file.public_id)
        row = requests["results"][0]
        self.assertEqual((row["id"], row["student_id"]), (doc_id, student_id))
        self.assertEqual([(f["id"], f["document"]) for f in row["files"]], [(file_id, doc_id)])
        self.assertEqual([s["id"] for s in requests["top5"]], [student_id])
        self.assertEqual([s["id"] for s in students["results"]], [student_id])
        self.assertEqual([s["id"] for s in rating["results"]], [student_id])

    def test_responses_have_no_user_numbers(self):
        self.client.force_authenticate(self.staff)

        payloads = {
            "requests": self.client.get(reverse("api:achievements-list")).json()["results"][0],
            "request": self.client.get(f"/api/v1/achievements/{self.doc.public_id}/").json(),
            "students": self.client.get(reverse("api:students-list")).json()["results"][0],
            "student": self.client.get(f"/api/v1/students/{self.student.public_id}/").json(),
            "rating": self.client.get(reverse("api:rating-list")).json()["results"][0],
        }

        self.assertEqual([name for name, payload in payloads.items() if "user_id" in payload], [])

    def test_own_profile_lists_requests_and_files_by_uuid(self):
        self.client.force_authenticate(self.user)

        profile = self.client.get(reverse("api:students-me")).json()

        self.assertEqual(profile["id"], str(self.student.public_id))
        self.assertEqual(
            [(d["id"], [f["id"] for f in d["files"]]) for d in profile["documents"]],
            [(str(self.doc.public_id), [str(self.file.public_id)])],
        )
