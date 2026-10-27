"""
Семестр = (учебный год, осень/весна): подпись собирается сама, даты по умолчанию - из
шаблона настроек, семестр заявки ищется по дате достижения.
"""
from datetime import date

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from django.urls import reverse

from rest_framework.test import APITestCase

from core.testing import TEST_SETTINGS, make_semester, make_staff
from university_structure.models import AcademicYear


class AcademicYearTests(TestCase):
    def test_label_built_from_year_and_term(self):
        autumn = make_semester(2025, "autumn")
        spring = make_semester(2025, "spring")

        self.assertEqual(autumn.label, "2025-2026 уч. год — осень")
        self.assertEqual(spring.label, "2025-2026 уч. год — весна")

    def test_fields_inferred_from_start_date(self):
        autumn = AcademicYear.objects.create(start_date=date(2025, 9, 1), end_date=date(2026, 1, 31))
        spring = AcademicYear.objects.create(start_date="2026-02-01", end_date="2026-08-31")

        self.assertEqual((autumn.year_start, autumn.term), (2025, "autumn"))
        self.assertEqual((spring.year_start, spring.term), (2025, "spring"))

    def test_template_dates(self):
        self.assertEqual(AcademicYear.template_dates(2025, "autumn"), (date(2025, 9, 1), date(2026, 1, 31)))
        self.assertEqual(AcademicYear.template_dates(2025, "spring"), (date(2026, 2, 1), date(2026, 8, 31)))

        spring = make_semester(2026, "spring")
        self.assertEqual((spring.start_date, spring.end_date), (date(2027, 2, 1), date(2027, 8, 31)))

    def test_explicit_dates_kept(self):
        autumn = make_semester(2025, "autumn", start_date=date(2025, 9, 15), end_date=date(2026, 1, 20))

        self.assertEqual((autumn.start_date, autumn.end_date), (date(2025, 9, 15), date(2026, 1, 20)))

    def test_year_semesters(self):
        spring = make_semester(2025, "spring")
        autumn = make_semester(2025, "autumn")
        make_semester(2024, "spring")

        self.assertEqual(list(AcademicYear.year_semesters(2025)), [autumn, spring])

    def test_semester_for_date_inside_current_year(self):
        autumn = make_semester(2025, "autumn", current=True)
        spring = make_semester(2025, "spring")

        self.assertEqual(AcademicYear.semester_for_date(date(2025, 10, 15)), autumn)
        self.assertEqual(AcademicYear.semester_for_date(date(2026, 3, 10)), spring)

    def test_semester_for_date_past_year(self):
        past = make_semester(2024, "spring")
        make_semester(2025, "autumn", current=True)
        make_semester(2025, "spring")

        self.assertEqual(AcademicYear.semester_for_date(date(2025, 5, 20)), past)

    def test_semester_for_date_after_year_end_before_transition(self):
        make_semester(2025, "autumn")
        spring = make_semester(2025, "spring", current=True)

        self.assertEqual(AcademicYear.semester_for_date(date(2026, 9, 15)), spring)

    def test_semester_for_date_ignores_next_year_before_transition(self):
        # Семестры следующего года завели вручную заранее: до перехода продолжается старый год.
        make_semester(2025, "autumn")
        spring = make_semester(2025, "spring", current=True)
        next_autumn = make_semester(2026, "autumn")

        self.assertEqual(AcademicYear.semester_for_date(date(2026, 9, 15)), spring)

        AcademicYear.objects.filter(pk=spring.pk).update(is_current=False)
        AcademicYear.objects.filter(pk=next_autumn.pk).update(is_current=True)
        self.assertEqual(AcademicYear.semester_for_date(date(2026, 9, 15)), next_autumn)

    def test_semester_for_date_none_outside(self):
        make_semester(2025, "autumn", current=True)
        make_semester(2025, "spring")

        self.assertIsNone(AcademicYear.semester_for_date(date(2025, 6, 1)))

    def test_unique_year_term(self):
        make_semester(2025, "autumn")

        with self.assertRaises(IntegrityError), transaction.atomic():
            make_semester(2025, "autumn", start_date=date(2025, 10, 1))

    def test_admin_form_needs_year_or_start(self):
        with self.assertRaises(ValidationError):
            AcademicYear().full_clean()



@override_settings(**TEST_SETTINGS)
class AcademicYearListTests(APITestCase):
    def test_new_semester_shows_up_at_once(self):
        # Список для селектора «Период»: после перехода на новый год он нужен сразу, а не через
        # 2 часа кэша (и браузерного тоже).
        self.client.force_authenticate(make_staff("rector", "Rectorate"))
        make_semester(2025, "autumn", current=True)
        first = self.client.get(reverse("api:academic-years-list"))

        make_semester(2025, "spring")
        labels = [s["label"] for s in self.client.get(reverse("api:academic-years-list")).data]

        self.assertEqual(first["Cache-Control"], "no-store")
        self.assertIn("2025-2026 уч. год — весна", labels)
