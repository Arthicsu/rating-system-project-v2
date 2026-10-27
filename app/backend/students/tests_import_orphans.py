"""
«Сироты» полной выгрузки: активные студенты групп, которых в файле нет совсем (например,
выпустившаяся группа). По умолчанию - только отчёт, со второй галочкой - архив.
"""
from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group as AuthGroup
from django.contrib.messages.storage.fallback import FallbackStorage
from django.test import RequestFactory, TestCase, override_settings

from core.testing import TEST_SETTINGS, make_department, make_group, make_student
from students.admin import StudentAdmin
from students.models import Student


@override_settings(**TEST_SETTINGS)
class ImportOrphansTests(TestCase):
    def setUp(self):
        self.admin = StudentAdmin(Student, AdminSite())
        AuthGroup.objects.get_or_create(name="Student")
        department = make_department("К1")
        self.in_file = make_group(department, "ИВТ-101")
        self.missing = make_group(department, "ИВТ-401", course=4)
        self.present = make_student("p@uni.ru", group=self.in_file)
        self.orphan = make_student("o@uni.ru", group=self.missing)
        self.no_group = make_student("n@uni.ru")

    def _row(self, user, group_code, status="1"):
        return {
            "Код": f"EXT-{user.username}", "Статус": status, "Код_Группы": group_code,
            "Фамилия": "П", "Имя": "П", "Отчество": "П", "E_Mail": user.email,
        }

    def _import(self, extra_rows=(), **flags):
        request = RequestFactory().post("/", {k: "on" for k, on in flags.items() if on})
        request.session = {}
        request._messages = FallbackStorage(request)
        # Пропущенные строки дают страницу итогов импорта - ей нужен пользователь админки.
        request.user = get_user_model().objects.create_superuser("oi-admin", password=None)
        self.admin.process_import(request, [self._row(self.present, self.in_file.external_id), *extra_rows])
        return [str(m) for m in request._messages]

    def _archived(self, user):
        return Student.objects.get(user=user).archived_at is not None

    def test_orphans_reported_not_archived_by_default(self):
        notes = self._import(archive_absent=True)

        self.assertFalse(self._archived(self.orphan))
        self.assertFalse(self._archived(self.no_group))
        report = [n for n in notes if "групп, которых нет в файле: 1" in n]
        self.assertEqual(len(report), 1, notes)
        self.assertIn("o@uni.ru", report[0])

    def test_orphans_archived_with_second_flag(self):
        self._import(archive_absent=True, archive_orphan_groups=True)

        self.orphan.refresh_from_db()
        self.assertTrue(self._archived(self.orphan))
        self.assertEqual(Student.objects.get(user=self.orphan).status, "6")
        self.assertFalse(self.orphan.is_active)
        self.assertFalse(self._archived(self.present))
        self.assertFalse(self._archived(self.no_group))

    def test_student_listed_in_file_is_never_an_orphan(self):
        # Строка студента пропущена (его новой группы ещё нет в БД, неизвестный статус), но сам
        # студент в выгрузке есть: его прежняя группа не в файле, а он - не «сирота».
        unknown_status = make_student("u@uni.ru", group=self.missing)
        rows = [self._row(self.orphan, "G-NOT-SYNCED"), self._row(unknown_status, self.missing.external_id, status="9")]

        notes = self._import(rows, archive_absent=True, archive_orphan_groups=True)

        self.assertFalse(self._archived(self.orphan))
        self.assertFalse(self._archived(unknown_status))
        self.assertFalse(any("групп, которых нет в файле" in n for n in notes), notes)

    def test_second_flag_requires_full_import_flag(self):
        notes = self._import(archive_orphan_groups=True)

        self.assertFalse(self._archived(self.orphan))
        self.assertTrue(any("не применялась" in n for n in notes), notes)

    def test_partial_import_does_not_report_orphans(self):
        notes = self._import()

        self.assertFalse(any("групп, которых нет в файле" in n for n in notes), notes)
