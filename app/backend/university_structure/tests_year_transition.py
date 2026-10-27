"""
Переход на следующий учебный год из админки: страница подтверждения ничего не меняет,
POST сначала делает копию БД, затем создаёт семестры нового года, фиксирует фактические
даты и обнуляет живой рейтинг (история цела). Плашка в админке напоминает о переходе,
авто-ролловера в расписании нет.
"""
import tempfile
from datetime import timedelta
from pathlib import Path
from unittest.mock import ANY, patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from core.tasks import backup_db_before_transition
from core.testing import DEFAULT_PASSWORD, TEST_SETTINGS, make_semester, make_student
from students.models import SemesterScore
from students.services import rebuild_current_semester_cache
from university_structure.models import AcademicYear

User = get_user_model()
URL = "admin:academic_year_transition"


@override_settings(**TEST_SETTINGS)
class YearTransitionTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.year = self.today.year - 1
        self.autumn = make_semester(
            self.year, "autumn", current=True,
            start_date=self.today - timedelta(days=400), end_date=self.today - timedelta(days=250),
        )
        self.spring = make_semester(
            self.year, "spring", start_date=self.today - timedelta(days=249), end_date=self.today - timedelta(days=10),
        )
        self.student = make_student("s@uni.ru").student_profile
        SemesterScore.objects.create(student=self.student, semester=self.spring, academic_score=10)
        rebuild_current_semester_cache()
        self.admin = User.objects.create_superuser("oi-admin", password=DEFAULT_PASSWORD)
        self.client.force_login(self.admin)
        # Настоящий pg_dump в тестах снял бы копию рабочей dev-базы: копию подменяем.
        backup = patch(
            "university_structure.admin.backup_db_before_transition",
            return_value=Path("/shared/backups/db/pre-transition/Project_20260901_100000.sql.gz"),
        )
        self.backup = backup.start()
        self.addCleanup(backup.stop)

    def _transition(self):
        return self.client.post(reverse(URL), {"confirm": "yes"})

    def test_transition_backs_up_database_first(self):
        resp = self.client.post(reverse(URL), {"confirm": "yes"}, follow=True)

        self.backup.assert_called_once_with()
        self.assertIn("Project_20260901_100000.sql.gz", resp.content.decode())
        self.assertEqual(AcademicYear.get_current().year_start, self.year + 1)

    def test_failed_backup_cancels_transition(self):
        self.backup.side_effect = RuntimeError("pg_dump failed (code 1): no space left")

        resp = self.client.post(reverse(URL), {"confirm": "yes"}, follow=True)

        self.assertIn("Копия базы данных не создана", resp.content.decode())
        self.assertEqual(AcademicYear.get_current(), self.autumn)
        self.assertEqual(AcademicYear.objects.count(), 2)
        self.student.refresh_from_db()
        self.assertEqual(self.student.total_score, 10)

    def test_refused_transition_makes_no_backup(self):
        self._transition()
        self.backup.reset_mock()

        self._transition()

        self.backup.assert_not_called()

    def test_preview_changes_nothing(self):
        resp = self.client.get(reverse(URL))

        self.assertEqual(resp.status_code, 200)
        self.assertTemplateUsed(resp, "admin/academic_year_transition_confirm.html")
        preview = resp.context["preview"]
        self.assertEqual(
            (preview["from_label"], preview["to_label"], preview["students_with_scores"]),
            (f"{self.year}-{self.year + 1} уч. год", f"{self.year + 1}-{self.year + 2} уч. год", 1),
        )
        self.assertEqual(AcademicYear.objects.count(), 2)
        self.assertEqual(AcademicYear.get_current(), self.autumn)

    def test_transition_creates_next_year_and_switches(self):
        resp = self._transition()

        self.assertEqual(resp.status_code, 302)
        new_autumn = AcademicYear.objects.get(year_start=self.year + 1, term="autumn")
        self.assertTrue(AcademicYear.objects.filter(year_start=self.year + 1, term="spring").exists())
        self.assertEqual(AcademicYear.get_current(), new_autumn)
        self.student.refresh_from_db()
        self.assertEqual(self.student.total_score, 0)
        self.assertEqual(SemesterScore.objects.get(student=self.student, semester=self.spring).total_score, 10)

    def test_transition_records_dates(self):
        self._transition()

        self.spring.refresh_from_db()
        new_autumn = AcademicYear.objects.get(year_start=self.year + 1, term="autumn")
        self.assertEqual(self.spring.end_date, self.today - timedelta(days=1))
        self.assertEqual(new_autumn.start_date, self.today)
        self.assertEqual(AcademicYear.semester_for_date(self.today - timedelta(days=5)), self.spring)
        self.assertEqual(AcademicYear.semester_for_date(self.today), new_autumn)

    def test_year_transition_confirm_twice_is_noop(self):
        self._transition()
        new_autumn = AcademicYear.get_current()
        SemesterScore.objects.create(student=self.student, semester=new_autumn, academic_score=3)
        rebuild_current_semester_cache()

        resp = self._transition()

        self.assertEqual(resp.status_code, 302)
        self.assertEqual(AcademicYear.objects.count(), 4)
        self.assertEqual(AcademicYear.get_current(), new_autumn)
        new_autumn.refresh_from_db()
        self.assertEqual(new_autumn.start_date, self.today)
        self.student.refresh_from_db()
        self.assertEqual(self.student.total_score, 3)

    def test_transition_refused_before_last_semester_start(self):
        AcademicYear.objects.filter(pk=self.spring.pk).update(
            start_date=self.today + timedelta(days=5), end_date=self.today + timedelta(days=100),
        )

        self._transition()

        self.assertEqual(AcademicYear.get_current(), self.autumn)
        self.assertEqual(AcademicYear.objects.count(), 2)

    def test_confirm_page_warns_before_planned_year_end(self):
        # Кнопка видна всегда: случайный переход посреди весны обнулил бы живой рейтинг года.
        AcademicYear.objects.filter(pk=self.spring.pk).update(end_date=self.today + timedelta(days=30))

        page = self.client.get(reverse(URL)).content.decode()

        self.assertIn("ещё не закончился", page)
        self.assertIn((self.today + timedelta(days=30)).strftime("%d.%m.%Y"), page)

    def test_no_warning_after_planned_year_end(self):
        self.assertNotIn("ещё не закончился", self.client.get(reverse(URL)).content.decode())

    def test_banner_when_year_ended(self):
        page = self.client.get(reverse("admin:index")).content.decode()

        self.assertIn("закончился 10 дн. назад", page)
        self._transition()
        self.assertNotIn("закончился", self.client.get(reverse("admin:index")).content.decode())

    def test_banner_without_current_period(self):
        AcademicYear.objects.update(is_current=False)

        self.assertIn("Текущий период не задан", self.client.get(reverse("admin:index")).content.decode())

    def test_backup_goes_to_its_own_folder(self):
        with tempfile.TemporaryDirectory() as tmp, override_settings(BACKUPS_DIR=tmp), \
                patch("core.tasks.dump_database", side_effect=lambda dest, ts: dest / f"db_{ts}.sql.gz") as dump:
            path = backup_db_before_transition()

            dump.assert_called_once_with(Path(tmp) / "db" / "pre-transition", ANY)
            self.assertTrue((Path(tmp) / "db" / "pre-transition").is_dir())
            self.assertEqual(path.parent, Path(tmp) / "db" / "pre-transition")

    def test_beat_has_no_auto_rollover(self):
        self.assertNotIn("auto-semester-rollover-daily", settings.CELERY_BEAT_SCHEDULE)

    def test_non_superuser_forbidden(self):
        operator = User.objects.create_user("operator", password=DEFAULT_PASSWORD, is_staff=True)
        self.client.force_login(operator)

        self.assertEqual(self.client.get(reverse(URL)).status_code, 403)
        self.assertEqual(self._transition().status_code, 403)
        self.assertEqual(AcademicYear.get_current(), self.autumn)
