"""
Excel за учебный год: второй лист «По семестрам» - баллы студента по каждому семестру
года (5 категорий + итог) и итог за год. За один семестр лист один. Scope - как у таблицы.
"""
import io
import re
import zipfile
from xml.etree import ElementTree

from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse

from rest_framework.test import APITestCase

from core.testing import TEST_SETTINGS, make_department, make_group, make_semester, make_staff, make_student
from students.models import SemesterScore

NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def read_workbook(content):
    """{имя листа: {адрес ячейки: значение}} - строки из sharedStrings, числа как int."""
    with zipfile.ZipFile(io.BytesIO(content)) as zf:
        strings = [
            "".join(t.text or "" for t in si.iter(f"{{{NS['x']}}}t"))
            for si in ElementTree.fromstring(zf.read("xl/sharedStrings.xml")).findall("x:si", NS)
        ]
        names = [s.get("name") for s in ElementTree.fromstring(zf.read("xl/workbook.xml")).iter(f"{{{NS['x']}}}sheet")]
        sheets = {}
        for index, name in enumerate(names, start=1):
            cells = {}
            for c in ElementTree.fromstring(zf.read(f"xl/worksheets/sheet{index}.xml")).iter(f"{{{NS['x']}}}c"):
                v = c.find("x:v", NS)
                if v is not None:
                    cells[c.get("r")] = strings[int(v.text)] if c.get("t") == "s" else int(float(v.text))
            sheets[name] = cells
    return sheets


def row_of(cells, text):
    """Номер строки, где встречается text, и все её значения по порядку колонок."""
    row = next(re.sub(r"\D", "", ref) for ref, value in cells.items() if value == text)
    refs = sorted((ref for ref in cells if re.sub(r"\D", "", ref) == row), key=lambda r: (len(r), r))
    return [cells[ref] for ref in refs]


@override_settings(**TEST_SETTINGS)
class YearExportSemesterSheetTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.autumn = make_semester(2024, "autumn")
        self.spring = make_semester(2024, "spring")
        make_semester(2025, "autumn", current=True)
        department = make_department("К1")
        mine = make_student("mine@uni.ru", group=make_group(department, "ИВТ-101")).student_profile
        other = make_student("other@uni.ru", group=make_group(make_department("К2"), "ПИ-101")).student_profile
        SemesterScore.objects.create(student=mine, semester=self.autumn, academic_score=3)
        SemesterScore.objects.create(student=mine, semester=self.spring, sport_score=4)
        SemesterScore.objects.create(student=other, semester=self.autumn, academic_score=9)
        self.client.force_authenticate(make_staff("kaf", "Department", department=department))

    def _export(self, **params):
        return read_workbook(self.client.get(reverse("api:rating-export"), params).content)

    def test_year_export_has_semester_sheet(self):
        self.assertEqual(list(self._export(year_start=2024)), ["Рейтинг", "По семестрам"])

    def test_semester_sheet_sums(self):
        sheet = self._export(year_start=2024)["По семестрам"]

        self.assertIn(self.autumn.label, sheet.values())
        self.assertIn(self.spring.label, sheet.values())
        self.assertIn("Итого за год", sheet.values())
        # ФИО, зачётка, группа, курс, факультет; осень: 5 категорий + итог; весна: то же; итог за год.
        self.assertEqual(
            row_of(sheet, "mine@uni.ru"),
            ["mine@uni.ru", "RB-mine@uni.ru", "ИВТ-101", 1, "F-К1", 3, 0, 0, 0, 0, 3, 0, 0, 4, 0, 0, 4, 7],
        )

    def test_single_semester_export_has_one_sheet(self):
        self.assertEqual(list(self._export(academic_year=self.autumn.id)), ["Рейтинг"])

    def test_breakdown_respects_scope(self):
        sheet = self._export(year_start=2024)["По семестрам"]

        self.assertNotIn("other@uni.ru", sheet.values())
