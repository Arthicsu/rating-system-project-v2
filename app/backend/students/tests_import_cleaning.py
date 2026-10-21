"""
Очистка CSV студентов перед импортом (по мотивам скрипта RemoveDublicateFromStudentCSV).

Среди активных строк с одной почтой (без учёта регистра и пробелов) остаётся
последняя, остальные уходят в отчёт. В отличие от скрипта: строки отчисленных
(3/4/6) не вырезаются - по ним импорт переводит студентов в архив; пустая почта
дублем не считается.
"""
import time

from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.contrib.messages.storage.fallback import FallbackStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.template.response import TemplateResponse
from django.test import RequestFactory, TestCase, override_settings
from django.urls import reverse

from core.testing import TEST_SETTINGS, make_department, make_group
from students.admin import StudentAdmin
from students.import_cleaning import build_import_report_csv, clean_student_rows
from students.models import Student

User = get_user_model()


def row(code, email, status="1", group="G-G1", last="Иванов"):
    return {"Код": code, "Статус": status, "Код_Группы": group, "E_Mail": email,
            "Фамилия": last, "Имя": "Иван", "Отчество": "Иванович"}


class CleanStudentRowsTests(TestCase):
    def test_same_code_repeat_keeps_last(self):
        first, last = row("C1", "a@x.ru", last="Старый"), row("C1", "a@x.ru", last="Новый")

        result = clean_student_rows([first, last])

        self.assertEqual(result.rows, [last])
        self.assertEqual(result.removed, [(first, "duplicate")])

    def test_email_conflict_keeps_last(self):
        first, last = row("C1", "a@x.ru"), row("C2", "a@x.ru")

        result = clean_student_rows([first, last])

        self.assertEqual(result.rows, [last])
        self.assertEqual(result.removed, [(first, "email_conflict")])

    def test_email_compared_case_insensitive(self):
        result = clean_student_rows([row("C1", "A@x.ru"), row("C1", " a@X.RU ")])

        self.assertEqual(len(result.rows), 1)

    def test_case_only_email_pair_is_one_person(self):
        first, last = row("C1", "Ivanov@x.ru"), row("C2", "ivanov@x.ru")

        result = clean_student_rows([first, last])

        self.assertEqual(result.rows, [last])
        self.assertEqual(result.removed[0][1], "email_conflict")

    def test_empty_emails_never_collapse(self):
        rows = [row("C1", ""), row("C2", "NULL"), row("C3", "  ")]

        result = clean_student_rows(rows)

        self.assertEqual(result.rows, rows)
        self.assertEqual(result.removed, [])

    def test_terminal_rows_pass_through(self):
        active = row("C1", "a@x.ru")
        expelled = row("C0", "a@x.ru", status="3")

        result = clean_student_rows([active, expelled])

        self.assertEqual(result.rows, [active, expelled])

    def test_order_preserved(self):
        rows = [row("C1", "a@x.ru"), row("C2", "b@x.ru"), row("C3", "a@x.ru"), row("C4", "c@x.ru")]

        result = clean_student_rows(rows)

        self.assertEqual([r["Код"] for r in result.rows], ["C2", "C3", "C4"])

    def test_linear_on_large_input(self):
        rows = [row(f"C{i}", f"s{i % 40_000}@x.ru") for i in range(50_000)]

        started = time.perf_counter()
        result = clean_student_rows(rows)

        self.assertLess(time.perf_counter() - started, 1.0)
        self.assertEqual(len(result.rows), 40_000)

    def test_report_csv_has_reason_column(self):
        removed = clean_student_rows([row("C1", "a@x.ru"), row("C2", "a@x.ru")]).removed

        report = build_import_report_csv(removed)

        header = report.lstrip("﻿").splitlines()[0].split(";")
        self.assertEqual(header[-1], "Причина")
        self.assertIn("Разные студенты с одной почтой", report)


@override_settings(**TEST_SETTINGS)
class ImportWithCleaningTests(TestCase):
    def setUp(self):
        self.group = make_group(make_department("К1"), "G1")

    def _request(self, post=None):
        request = RequestFactory().post("/", post or {})
        setattr(request, "user", AnonymousUser())  # контекст админки на странице итогов
        setattr(request, "session", {})
        setattr(request, "_messages", FallbackStorage(request))
        return request

    def test_import_with_two_new_same_email_no_longer_crashes(self):
        rows = [row("C1", "a@x.ru"), row("C2", "a@x.ru", last="Петров")]

        response = StudentAdmin(Student, AdminSite()).process_import(
            self._request({"clean_duplicates": "on"}), rows,
        )

        self.assertEqual(list(Student.objects.values_list("external_id", flat=True)), ["C2"])
        self.assertIsInstance(response, TemplateResponse)
        self.assertEqual(response.template_name, "admin/student_import_result.html")

    def _reasons(self, response):
        return [item["reason_code"] for item in response.context_data["preview"]]

    def test_import_without_cleaning_skips_taken_email(self):
        rows = [row("C1", "a@x.ru"), row("C2", "a@x.ru")]

        # Раньше без очистки второй create_user с тем же логином ронял весь импорт (IntegrityError).
        response = StudentAdmin(Student, AdminSite()).process_import(self._request(), rows)

        self.assertEqual(list(Student.objects.values_list("external_id", flat=True)), ["C1"])
        self.assertEqual(self._reasons(response), ["email_taken"])

    def test_email_taken_by_existing_account_is_reported(self):
        User.objects.create_user(username="a@x.ru", password="x")  # аккаунт из прошлой выгрузки

        response = StudentAdmin(Student, AdminSite()).process_import(
            self._request({"clean_duplicates": "on"}), [row("NEW", "A@x.ru")],
        )

        self.assertFalse(Student.objects.filter(external_id="NEW").exists())
        self.assertEqual(self._reasons(response), ["email_taken"])

    def test_rows_without_group_are_in_report(self):
        response = StudentAdmin(Student, AdminSite()).process_import(
            self._request({"clean_duplicates": "on"}), [row("C1", "a@x.ru", group="НЕТ-ГРУППЫ")],
        )

        self.assertIsInstance(response, TemplateResponse)
        self.assertEqual(self._reasons(response), ["no_group"])
        self.assertEqual(response.context_data["counts"]["no_group"], 1)

    def test_clean_import_redirects_as_before(self):
        result = StudentAdmin(Student, AdminSite()).process_import(
            self._request({"clean_duplicates": "on"}), [row("C1", "a@x.ru")],
        )

        self.assertEqual(result, 1)  # без пропусков - обычный редирект с сообщениями

    def test_import_view_shows_result_page_with_report(self):
        admin_user = User.objects.create_superuser("oi", "oi@x.ru", "pass12345")
        self.client.force_login(admin_user)
        content = "Код;Статус;Код_Группы;E_Mail;Фамилия;Имя;Отчество\n" \
                  "C1;1;G-G1;a@x.ru;Иванов;Иван;Иванович\n" \
                  "C2;1;G-G1;A@x.ru;Петров;Пётр;Петрович\n"
        upload = SimpleUploadedFile("students.csv", content.encode("utf-8-sig"), content_type="text/csv")

        resp = self.client.post(
            reverse("admin:import-student"), {"file": upload, "clean_duplicates": "on"},
        )

        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "Скачать CSV")
        self.assertContains(resp, "data:text/csv")
        self.assertEqual(Student.objects.count(), 1)
