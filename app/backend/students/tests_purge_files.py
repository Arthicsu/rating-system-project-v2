"""
Ручная чистка файлов архивных студентов: кнопка на списке студентов в админке ведёт на
страницу подтверждения со сводкой; удаляются только файлы студентов, архивных дольше
ARCHIVED_FILES_RETENTION_DAYS. Заявки, баллы и история остаются.
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from core.testing import (
    DEFAULT_PASSWORD, FILE_TEST_SETTINGS, make_catalog, make_department, make_doc, make_group,
    make_statuses, make_student,
)
from students.models import Document, DocumentFile, Student

User = get_user_model()
URL = "admin:students_purge_archived_files"


@override_settings(**FILE_TEST_SETTINGS, ARCHIVED_FILES_RETENTION_DAYS=365)
class PurgeArchivedFilesTests(TestCase):
    def setUp(self):
        statuses = make_statuses()
        catalog = make_catalog()
        group = make_group(make_department("К1"), "ИВТ-101")
        now = timezone.now()
        self.old = self._student_with_file("old@uni.ru", group, catalog, statuses, now - timedelta(days=400))
        self.recent = self._student_with_file("recent@uni.ru", group, catalog, statuses, now - timedelta(days=10))
        self.active = self._student_with_file("active@uni.ru", group, catalog, statuses, None)
        self.admin = User.objects.create_superuser("oi-admin", password=DEFAULT_PASSWORD)
        self.client.force_login(self.admin)

    def _student_with_file(self, username, group, catalog, statuses, archived_at):
        user = make_student(username, group=group)
        Student.objects.filter(user=user).update(archived_at=archived_at)
        doc = make_doc(user, catalog, statuses["approved"])
        stored = DocumentFile.objects.create(document=doc, original_file_name="a.pdf", file=ContentFile(b"x" * 2048, name="a.pdf"))
        return doc, stored.file.name

    def _files(self, case):
        return DocumentFile.objects.filter(document=case[0]).count()

    def test_confirmation_page_changes_nothing(self):
        resp = self.client.get(reverse(URL))

        self.assertEqual(resp.status_code, 200)
        self.assertTemplateUsed(resp, "admin/purge_archived_files_confirm.html")
        self.assertEqual(
            {k: resp.context["summary"][k] for k in ("students", "documents", "files")},
            {"students": 1, "documents": 1, "files": 1},
        )
        for case in (self.old, self.recent, self.active):
            self.assertEqual(self._files(case), 1)
            self.assertTrue(default_storage.exists(case[1]))

    def test_purge_only_archived_older_than_retention(self):
        with self.captureOnCommitCallbacks(execute=True):
            resp = self.client.post(reverse(URL), {"confirm": "yes"})

        self.assertEqual(resp.status_code, 302)
        self.assertEqual(self._files(self.old), 0)
        self.assertFalse(default_storage.exists(self.old[1]))
        for case in (self.recent, self.active):
            self.assertEqual(self._files(case), 1)
            self.assertTrue(default_storage.exists(case[1]))

    def test_post_without_confirm_changes_nothing(self):
        self.client.post(reverse(URL), {})

        self.assertEqual(self._files(self.old), 1)

    def test_purge_keeps_scores_and_documents(self):
        student = Student.objects.get(user__username="old@uni.ru")
        Student.objects.filter(pk=student.pk).update(academic_score=10)

        self.client.post(reverse(URL), {"confirm": "yes"})

        self.assertTrue(Document.objects.filter(pk=self.old[0].pk).exists())
        self.assertEqual(Student.objects.get(pk=student.pk).academic_score, 10)

    def test_purge_sets_files_purged_at(self):
        self.client.post(reverse(URL), {"confirm": "yes"})

        self.assertIsNotNone(Document.objects.get(pk=self.old[0].pk).files_purged_at)
        self.assertIsNone(Document.objects.get(pk=self.recent[0].pk).files_purged_at)
        self.assertIsNone(Document.objects.get(pk=self.active[0].pk).files_purged_at)

    def test_purge_is_audited(self):
        with self.assertLogs("audit", "INFO") as logs:
            self.client.post(reverse(URL), {"confirm": "yes"})

        self.assertIn(f"purge archived files by={self.admin.pk} students=1 documents=1 files=1", "\n".join(logs.output))

    def test_non_superuser_forbidden(self):
        operator = User.objects.create_user("operator", password=DEFAULT_PASSWORD, is_staff=True)
        self.client.force_login(operator)

        self.assertEqual(self.client.get(reverse(URL)).status_code, 403)
        self.assertEqual(self.client.post(reverse(URL), {"confirm": "yes"}).status_code, 403)
        self.assertEqual(self._files(self.old), 1)
