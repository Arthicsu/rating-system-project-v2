"""
Правка заявки студентом по отдельным файлам (спек 2г): remove_file_ids удаляет выбранные
файлы этой заявки, files — добавляются к оставшимся. Итог 1..MAX_FILES файлов и не больше
MAX_TOTAL_SIZE; из хранилища удалённые стираются только после коммита.
"""
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from core.testing import FILE_TEST_SETTINGS, make_catalog, make_doc, make_statuses, make_student
from students import serializers as achievement_serializers
from unittest.mock import patch

from rest_framework.exceptions import ValidationError

from students.models import DocumentFile
from students.services import update_achievement

DETAIL = "api:achievements-detail"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


def png(name="proof.png", size=None):
    body = PNG if size is None else PNG + b"\x00" * (size - len(PNG))
    return SimpleUploadedFile(name, body, content_type="image/png")


@override_settings(**FILE_TEST_SETTINGS)
class EditFilesTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.statuses = make_statuses()
        self.catalog = make_catalog()
        self.student = make_student("stud@uni.ru")
        self.doc = make_doc(self.student, self.catalog, self.statuses["pending"])
        self.first = self._attach("a.png", 0)
        self.second = self._attach("b.png", 1)
        self.client.force_authenticate(self.student)

    def _attach(self, name, order, doc=None):
        file = DocumentFile(document=doc or self.doc, original_file_name=name, order=order)
        file.file.save(name, ContentFile(PNG), save=False)
        file.save()
        return file

    def _patch(self, doc=None, **data):
        return self.client.patch(reverse(DETAIL, args=[(doc or self.doc).public_id]), data, format="multipart")

    def _names(self):
        return list(self.doc.files.order_by("order").values_list("original_file_name", "order"))

    def test_remove_one_of_two_files(self):
        resp = self._patch(remove_file_ids=[self.first.public_id])

        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.assertEqual(self._names(), [("b.png", 0)])

    def test_replace_file_in_one_patch(self):
        resp = self._patch(remove_file_ids=[self.first.public_id], files=[png("c.png")])

        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.assertEqual(self._names(), [("b.png", 0), ("c.png", 1)])

    def test_remove_foreign_file_400(self):
        other = make_doc(make_student("other@uni.ru"), self.catalog, self.statuses["pending"])
        foreign = self._attach("x.png", 0, doc=other)

        resp = self._patch(remove_file_ids=[foreign.public_id])

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("remove_file_ids", resp.data)
        self.assertTrue(DocumentFile.objects.filter(pk=foreign.pk).exists())

    def test_remove_all_without_new_400(self):
        resp = self._patch(remove_file_ids=[self.first.public_id, self.second.public_id])

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.doc.files.count(), 2)

    def test_more_than_three_files_400(self):
        resp = self._patch(files=[png("c.png"), png("d.png")])

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.doc.files.count(), 2)

    def test_total_size_over_limit_400(self):
        # Оставшиеся (2 маленьких) + новый на весь лимит — больше лимита вместе.
        limit = achievement_serializers.MAX_TOTAL_SIZE
        resp = self._patch(files=[png("big.png", size=limit - len(PNG))])

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.doc.files.count(), 2)

    def test_storage_deleted_only_after_commit(self):
        name = self.first.file.name
        storage = self.first.file.storage

        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            resp = self._patch(remove_file_ids=[self.first.public_id])
            self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
            self.assertTrue(storage.exists(name))

        for callback in callbacks:
            callback()
        self.assertFalse(storage.exists(name))

    def test_invalid_new_file_keeps_old_files(self):
        exe = SimpleUploadedFile("virus.exe", b"MZ" + b"\x00" * 32, content_type="application/octet-stream")

        resp = self._patch(remove_file_ids=[self.first.public_id], files=[exe])

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.doc.files.count(), 2)
        self.assertTrue(self.first.file.storage.exists(self.first.file.name))

    def test_approved_doc_403(self):
        approved = make_doc(self.student, self.catalog, self.statuses["approved"])
        file = self._attach("z.png", 0, doc=approved)

        resp = self._patch(doc=approved, remove_file_ids=[file.public_id], files=[png()])

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(DocumentFile.objects.filter(pk=file.pk).exists())

    def test_detail_exposes_file_size(self):
        resp = self.client.get(reverse(DETAIL, args=[self.doc.public_id]))

        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.assertEqual([f["size"] for f in resp.data["files"]], [len(PNG), len(PNG)])

    def test_text_edit_of_legacy_doc_without_files(self):
        # Старые заявки бывают без файлов: правка текста не должна требовать файлы.
        legacy = make_doc(self.student, self.catalog, self.statuses["pending"])

        resp = self._patch(doc=legacy, achievement="исправлено")

        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)

    # Лимиты перепроверяются под блокировкой строки: параллельные PATCH прошли валидацию
    # сериализатора по одному и тому же старому состоянию файлов.
    def test_limits_rechecked_under_lock_for_count(self):
        self._attach("c.png", 2)  # «параллельный» PATCH уже добавил третий файл

        with self.assertRaises(ValidationError):
            update_achievement(self.doc, {}, files=[png("d.png")], remove_file_ids=[])

        self.assertEqual(self.doc.files.count(), 3)

    def test_parallel_removals_cannot_leave_zero_files(self):
        update_achievement(self.doc, {}, remove_file_ids=[self.first.public_id])

        with self.assertRaises(ValidationError):
            update_achievement(self.doc, {}, remove_file_ids=[self.second.public_id])

        self.assertEqual(self.doc.files.count(), 1)

    def test_already_removed_id_is_rejected(self):
        update_achievement(self.doc, {}, remove_file_ids=[self.first.public_id], files=[png("c.png")])

        with self.assertRaises(ValidationError):
            update_achievement(self.doc, {}, remove_file_ids=[self.first.public_id])

    def test_storage_failure_does_not_count_as_zero(self):
        # Сбой хранилища (таймаут S3) не должен считаться «0 байт» и пропускать лимит.
        with patch("django.core.files.storage.InMemoryStorage.size", side_effect=RuntimeError("S3 timeout")):
            resp = self._patch(files=[png("c.png")])

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.doc.files.count(), 2)

    def test_missing_storage_object_counts_as_zero(self):
        self.first.file.storage.delete(self.first.file.name)

        resp = self._patch(files=[png("c.png")])

        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)

