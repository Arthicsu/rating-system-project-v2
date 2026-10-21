"""
Пароли сотрудников из админки одним CSV.

Учётки кафедр, деканатов и ректората общие, паролями управляет ОИ: суперпользователь
выбирает учётки, подтверждает и сразу получает CSV с новыми паролями. На сервере файл
не хранится - потерял, запусти заново (старые пароли и сессии перестают работать).
"""
import csv
import io
import os
import re
import tempfile
from unittest import mock

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.contrib.messages import get_messages
from django.core.cache import cache
from django.db import DatabaseError
from django.test import TestCase, override_settings
from django.urls import reverse

from rest_framework.test import APIClient

from core.testing import DEFAULT_PASSWORD, TEST_SETTINGS, make_department, make_staff, make_student
from university_structure.models import Staff

User = get_user_model()

STAFF_CHANGELIST = "admin:university_structure_staff_changelist"
USER_CHANGELIST = "admin:users_user_changelist"


@override_settings(**TEST_SETTINGS)
class StaffPasswordsCsvTests(TestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_superuser("oi-admin", password=DEFAULT_PASSWORD)
        self.client.force_login(self.admin)
        dept = make_department("ИТ")
        self.dept_user = make_staff("kaf-it", "Department", department=dept)
        self.dean_user = make_staff("dean-f", "Dean", faculty=dept.faculty)

    def _post(self, changelist, users, confirm=True):
        data = {"action": "generate_passwords_csv", "_selected_action": [u.pk for u in users]}
        if changelist == STAFF_CHANGELIST:
            data["_selected_action"] = [u.staff_profile.pk for u in users]
        if confirm:
            data["post"] = "yes"
        return self.client.post(reverse(changelist), data)

    def _rows(self, resp):
        text = resp.content.decode("utf-8")
        self.assertTrue(text.startswith("\ufeff"), "нет BOM - Excel не поймёт кириллицу")
        return list(csv.reader(io.StringIO(text[1:]), delimiter=";"))

    def _messages(self, resp):
        return " ".join(str(m) for m in get_messages(resp.wsgi_request))

    def _refresh(self, *users):
        return [User.objects.get(pk=u.pk) for u in users]

    def test_first_post_asks_for_confirmation_and_changes_nothing(self):
        resp = self._post(STAFF_CHANGELIST, [self.dept_user, self.dean_user], confirm=False)

        self.assertEqual(resp.status_code, 200)
        self.assertTemplateUsed(resp, "admin/staff_passwords_confirm.html")
        self.assertContains(resp, "kaf-it")
        self.assertContains(resp, "dean-f")
        for user in self._refresh(self.dept_user, self.dean_user):
            self.assertTrue(user.check_password(DEFAULT_PASSWORD))

    def test_confirm_page_leads_back_to_list(self):
        # После скачивания браузер остаётся на этой странице - путь к списку должен быть на ней.
        resp = self._post(STAFF_CHANGELIST, [self.dept_user], confirm=False)

        self.assertContains(
            resp, f'<a href="{reverse(STAFF_CHANGELIST)}">Вернуться к списку «Сотрудники»</a>', html=True
        )

    def test_confirm_page_warns_about_skipped_accounts(self):
        resp = self._post(USER_CHANGELIST, [make_student("stud@uni.ru"), self.dept_user], confirm=False)

        self.assertContains(resp, 'class="warning">Пропущено учёток: 1')

    def test_success_message_names_the_file(self):
        resp = self._post(STAFF_CHANGELIST, [self.dept_user, self.dean_user])

        filename = re.search(r'filename="([^"]+)"', resp["Content-Disposition"]).group(1)
        success = [str(m) for m in get_messages(resp.wsgi_request) if m.level_tag == "success"]
        self.assertEqual(len(success), 1)
        self.assertIn("учёток: 2", success[0])
        self.assertIn(filename, success[0])

    def test_action_returns_csv_and_changes_passwords(self):
        resp = self._post(STAFF_CHANGELIST, [self.dept_user, self.dean_user])

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "text/csv; charset=utf-8")
        self.assertRegex(
            resp["Content-Disposition"],
            # Секунды - чтобы два файла подряд не получили одно имя и не перепутались.
            r'^attachment; filename="staff_passwords_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.csv"$',
        )
        # Файл с паролями не должен оседать ни в каком кэше.
        self.assertIn("no-store", resp["Cache-Control"])
        header, *rows = self._rows(resp)
        self.assertEqual(header, ["Логин", "Подразделение", "Пароль"])
        self.assertEqual(
            sorted((login, unit) for login, unit, _ in rows),
            [("dean-f", "Факультет F-ИТ"), ("kaf-it", "Кафедра ИТ")],
        )
        passwords = {login: password for login, _, password in rows}
        for user in self._refresh(self.dept_user, self.dean_user):
            self.assertTrue(user.check_password(passwords[user.username]))
            self.assertFalse(user.check_password(DEFAULT_PASSWORD))
        self.assertNotEqual(passwords["kaf-it"], passwords["dean-f"])

    def test_nothing_written_to_disk(self):
        with tempfile.TemporaryDirectory() as tmp, override_settings(IMPORT_PASSWORDS_DIR=tmp):
            self._post(STAFF_CHANGELIST, [self.dept_user])

            self.assertEqual(os.listdir(tmp), [])

    def test_user_admin_action_skips_non_staff(self):
        student = make_student("stud@uni.ru")

        resp = self._post(USER_CHANGELIST, [student, self.dept_user])

        self.assertEqual([row[0] for row in self._rows(resp)[1:]], ["kaf-it"])
        self.assertTrue(self._refresh(student)[0].check_password(DEFAULT_PASSWORD))

    def test_accounts_that_must_not_be_in_file_are_skipped(self):
        # Пароли суперпользователей, учёток с доступом в админку и студентов не должны
        # попасть в файл, который раздают кафедрам, даже если у них есть профиль сотрудника.
        kinds = {
            "superuser": User.objects.create_superuser("oi-boss", password=DEFAULT_PASSWORD),
            "is_staff": User.objects.create_user("oi-operator", password=DEFAULT_PASSWORD, is_staff=True),
            "student": make_student("stud@uni.ru"),
        }
        for kind, user in kinds.items():
            with self.subTest(kind):
                Staff.objects.create(user=user)

                resp = self._post(USER_CHANGELIST, [user, self.dept_user])

                self.assertEqual([row[0] for row in self._rows(resp)[1:]], ["kaf-it"])
                self.assertTrue(self._refresh(user)[0].check_password(DEFAULT_PASSWORD))

    def test_confirm_form_round_trip(self):
        # Шаг 1 - как его шлёт настоящий список (с index), шаг 2 - скрытые поля самой формы.
        page = self.client.post(reverse(STAFF_CHANGELIST), {
            "action": "generate_passwords_csv",
            "index": "0",
            "_selected_action": [self.dept_user.staff_profile.pk],
        })
        data = {}
        for name, value in re.findall(r'<input type="hidden" name="([^"]+)" value="([^"]*)">', page.content.decode()):
            data.setdefault(name, []).append(value)

        resp = self.client.post(reverse(STAFF_CHANGELIST), data)

        # В форму списка сотрудников уходят pk Staff, а не User.
        self.assertEqual(data["_selected_action"], [str(self.dept_user.staff_profile.pk)])
        self.assertEqual([row[0] for row in self._rows(resp)[1:]], ["kaf-it"])

    def test_failure_midway_changes_no_password(self):
        original_save = User.save
        saves = []

        def flaky_save(user, *args, **kwargs):
            saves.append(user.pk)
            if len(saves) == 2:
                raise DatabaseError("сбой на второй учётке")
            return original_save(user, *args, **kwargs)

        with mock.patch.object(User, "save", flaky_save), self.assertRaises(DatabaseError):
            self._post(STAFF_CHANGELIST, [self.dept_user, self.dean_user])

        # Иначе первая учётка осталась бы с паролем, которого нет ни в одном файле.
        for user in self._refresh(self.dept_user, self.dean_user):
            self.assertTrue(user.check_password(DEFAULT_PASSWORD))

    def test_only_non_staff_selected_gives_no_file(self):
        student = make_student("stud@uni.ru")

        resp = self._post(USER_CHANGELIST, [student])

        self.assertRedirects(resp, reverse(USER_CHANGELIST))
        self.assertIn("нет учёток сотрудников", self._messages(resp))
        self.assertTrue(self._refresh(student)[0].check_password(DEFAULT_PASSWORD))

    def test_existing_staff_sessions_are_dropped(self):
        api = APIClient()
        api.post(reverse("api:auth-login"), {"username": "kaf-it", "password": DEFAULT_PASSWORD})
        self.assertIs(api.get(reverse("api:auth-session")).data["isAuthenticated"], True)

        self._post(STAFF_CHANGELIST, [self.dept_user])

        self.assertIs(api.get(reverse("api:auth-session")).data["isAuthenticated"], False)

    def test_audit_log_has_no_passwords(self):
        with self.assertLogs("audit", level="INFO") as logs:
            resp = self._post(STAFF_CHANGELIST, [self.dept_user, self.dean_user])

        passwords = [row[2] for row in self._rows(resp)[1:]]
        record = "\n".join(logs.output)
        self.assertIn(f"by={self.admin.pk} count=2", record)
        for password in passwords:
            self.assertNotIn(password, record)

    def test_non_superuser_admin_cannot_regenerate(self):
        # В админку пускают только суперпользователей, но is_staff с правом просмотра
        # сотрудников всё равно не должен менять чужие пароли.
        operator = User.objects.create_user("operator", password=DEFAULT_PASSWORD, is_staff=True)
        operator.user_permissions.add(Permission.objects.get(codename="view_staff"))
        self.client.force_login(operator)

        resp = self._post(STAFF_CHANGELIST, [self.dept_user])

        self.assertNotEqual(resp.get("Content-Type"), "text/csv; charset=utf-8")
        self.assertIn("только суперпользователь", self._messages(resp))
        self.assertTrue(self._refresh(self.dept_user)[0].check_password(DEFAULT_PASSWORD))
