"""
Тесты синхронизации справочников из ЭОС (core.eos.syncers).

Сеть не задействуется: в синхронизаторы подставляется FakeEOSClient с реальными по форме
JSON-ответами публичных ручек /faculties, /Kafs, /GroupsList, /ListFormStudy.
"""
from django.test import TestCase

from core.eos.syncers import FacultySyncer, DepartmentSyncer, GroupSyncer, run_all
from university_structure.models import Faculty, Department, Group


class FakeEOSClient:
    def get_faculties(self):
        return [
            {"facultyID": 25, "facultyName": "Инженерно-экономический институт",
             "facultyShortName": "ИЭИ", "dekan": "Жиленкова Е.П", "phoneNumber": "74-05-33"},
        ]

    def get_departments(self):
        return [
            {"kafedraID": 4, "kafedraName": "Информационные технологии", "kafedraShortName": "ИТ",
             "kafedraZav": "Иванов И.И.", "kafedraPhone": "74-16-46", "faculID": 25, "isDeleted": None},
        ]

    def get_groups(self):
        return [
            {"groupID": 1739, "groupName": "ИВТ-301", "course": 3, "form": "Очная форма",
             "speciality": "Информатика и вычислительная техника", "specialityShifr": "09.03.01",
             "planName": "09.03.01-2023.plx", "faculty": "ИЭИ", "year": "2025-2026", "facultyID": 25},
        ]

    def get_form_study(self):
        return [{"name": "Очная форма", "id": 1}, {"name": "Заочная форма", "id": 2}]


class EosSyncTests(TestCase):
    def test_faculty_fields(self):
        stats = FacultySyncer(FakeEOSClient()).run()
        self.assertEqual((stats.created, stats.errors), (1, []))
        f = Faculty.objects.get(external_id="25")
        self.assertEqual(f.short_name, "ИЭИ")
        self.assertEqual(f.dean_name, "Жиленкова Е.П")

    def test_department_links_faculty(self):
        client = FakeEOSClient()
        FacultySyncer(client).run()
        stats = DepartmentSyncer(client).run()
        self.assertEqual((stats.created, stats.errors), (1, []))
        d = Department.objects.get(external_id="4")
        self.assertEqual(d.short_name, "ИТ")
        self.assertEqual(d.head_name, "Иванов И.И.")
        self.assertEqual(d.faculty.external_id, "25")

    def test_group_links_faculty_and_decodes_form(self):
        client = FakeEOSClient()
        FacultySyncer(client).run()
        stats = GroupSyncer(client).run()
        self.assertEqual((stats.created, stats.errors), (1, []))
        g = Group.objects.get(external_id="1739")
        self.assertEqual(g.faculty.external_id, "25")
        self.assertEqual(g.education_form, "1")
        self.assertEqual(g.education_form_decode, "Очная форма")
        self.assertEqual(g.academic_year, "2025-2026")

    def test_idempotent(self):
        client = FakeEOSClient()
        FacultySyncer(client).run()
        stats = FacultySyncer(client).run()
        self.assertEqual((stats.created, stats.updated), (0, 1))
        self.assertEqual(Faculty.objects.filter(external_id="25").count(), 1)

    def test_run_all_order(self):
        results = run_all(FakeEOSClient())
        self.assertEqual([s.entity for s in results], ["Факультеты", "Кафедры", "Группы"])
        self.assertTrue(all(s.ok for s in results))
        self.assertEqual(Group.objects.get(external_id="1739").faculty.short_name, "ИЭИ")
