"""
Проверка самих фабрик core/testing.py: на них опираются тесты прав и scope,
поэтому цепочка студент -> группа -> специальность -> кафедра должна давать
ровно ту область видимости, что и в проде.
"""
from django.test import TestCase, override_settings

from core import scoping
from core.testing import (
    TEST_SETTINGS,
    make_catalog,
    make_department,
    make_doc,
    make_group,
    make_staff,
    make_statuses,
    make_student,
)


@override_settings(**TEST_SETTINGS)
class FactoriesScopeTests(TestCase):
    def test_department_staff_scope_follows_group_chain(self):
        dep_a = make_department("A")
        dep_b = make_department("B", faculty=dep_a.faculty)
        own = make_student("own@uni.ru", group=make_group(dep_a, "GA"))
        foreign = make_student("foreign@uni.ru", group=make_group(dep_b, "GB"))
        staff = make_staff("dept-a", "Department", department=dep_a)

        self.assertTrue(scoping.student_in_scope(staff, own.student_profile))
        self.assertFalse(scoping.student_in_scope(staff, foreign.student_profile))

    def test_dean_scope_is_faculty(self):
        dep = make_department("A")
        student = make_student("s@uni.ru", group=make_group(dep, "GA"))
        dean = make_staff("dean-a", "Dean", faculty=dep.faculty)
        other_dean = make_staff("dean-x", "Dean", faculty=make_department("X").faculty)

        self.assertTrue(scoping.student_in_scope(dean, student.student_profile))
        self.assertFalse(scoping.student_in_scope(other_dean, student.student_profile))

    def test_unusable_password_and_doc_score(self):
        user = make_student("nopass@uni.ru", password=None)
        doc = make_doc(user, make_catalog(score=7), make_statuses()["pending"])

        self.assertFalse(user.has_usable_password())
        self.assertEqual(doc.score, 7)
