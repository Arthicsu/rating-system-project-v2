"""
Права модерации по варианту А «Кафедра решает, руководство контролирует» (спек 2д).

Кафедра одобряет новые и отклонённые, отклоняет новые и подтверждённые; декан и ректорат
не одобряют, а отклоняют подтверждённые (окончательно, студенту) или возвращают
подтверждённые/отклонённые кафедре. Всё остальное — 400 без изменений статуса и баллов.
"""
from django.contrib.auth.models import Group as AuthGroup
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APITestCase

from core.testing import (
    TEST_SETTINGS,
    make_catalog,
    make_department,
    make_doc,
    make_group,
    make_semester,
    make_staff,
    make_statuses,
    make_student,
)
from students.models import Document, ScoringRule, SemesterScore
from students.services import credit_document, delete_achievement, review_document, update_achievement
from core.exceptions import InvalidDocumentState
from university_structure.models import AcademicYear, Staff

REVIEW = "api:achievements-review"
LIST = "api:achievements-list"
REASON = "Нет подписи"
SCORE = 10

_LEADERSHIP_RULES = {
    ("reject", "approved"): ("rejected", -SCORE),
    ("return", "approved"): ("pending", -SCORE),
    ("return", "rejected"): ("pending", 0),
}
# (роль, действие, исходный статус) -> (новый статус, изменение баллов). Остальное запрещено.
ALLOWED = {
    ("Department", "approve", "pending"): ("approved", SCORE),
    ("Department", "approve", "rejected"): ("approved", SCORE),
    ("Department", "reject", "pending"): ("rejected", 0),
    ("Department", "reject", "approved"): ("rejected", -SCORE),
    **{("Dean", *key): value for key, value in _LEADERSHIP_RULES.items()},
    **{("Rectorate", *key): value for key, value in _LEADERSHIP_RULES.items()},
}


@override_settings(**TEST_SETTINGS)
class ReviewRulesTests(APITestCase):
    def setUp(self):
        cache.clear()
        AcademicYear.objects.all().delete()
        self.semester = make_semester(2026, "autumn", current=True)
        self.statuses = make_statuses()
        self.catalog = make_catalog(score=SCORE)
        self.dept = dept = make_department("ИТ")
        self.student = make_student("stud@uni.ru", group=make_group(dept, "ИТ-1"))
        self.reviewers = {
            "Department": make_staff("kaf-it", "Department", department=dept),
            "Dean": make_staff("dean-it", "Dean", faculty=dept.faculty),
            "Rectorate": make_staff("rector", "Rectorate"),
        }
        other_dept = make_department("ФИЗ")
        self.foreign = {
            "Department": make_staff("kaf-fiz", "Department", department=other_dept),
            "Dean": make_staff("dean-fiz", "Dean", faculty=other_dept.faculty),
        }

    def _doc(self, code):
        doc = make_doc(
            self.student, self.catalog, self.statuses[code], semester=self.semester,
            rejection_reason="Старая причина" if code == "rejected" else "",
        )
        if code == "approved":
            # Подтверждённая заявка уже дала баллы — иначе списание упрётся в ноль.
            credit_document(doc)
        return doc

    def _score(self):
        row = SemesterScore.objects.filter(student=self.student.student_profile, semester=self.semester).first()
        return row.academic_score if row else 0

    def _review(self, reviewer, doc, action, reasons=(REASON,)):
        self.client.force_authenticate(reviewer)
        return self.client.post(reverse(REVIEW, args=[doc.public_id]), {"action": action, "reasons": list(reasons)})

    def test_matrix(self):
        for role, reviewer in self.reviewers.items():
            for action in ("approve", "reject", "return"):
                for code in ("pending", "approved", "rejected"):
                    with self.subTest(role=role, action=action, status=code):
                        doc = self._doc(code)
                        before = self._score()

                        resp = self._review(reviewer, doc, action)

                        doc.refresh_from_db()
                        expected = ALLOWED.get((role, action, code))
                        if expected is None:
                            self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST, resp.data)
                            self.assertEqual(doc.status.code, code)
                            self.assertEqual(self._score(), before)
                            continue

                        new_code, delta = expected
                        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
                        self.assertTrue(resp.data["message"])
                        self.assertEqual(doc.status.code, new_code)
                        self.assertEqual(self._score(), before + delta)
                        self.assertEqual(doc.verified_by, reviewer)
                        self.assertEqual(doc.rejection_reason, "" if action == "approve" else REASON)

    def test_return_without_reason_400(self):
        doc = self._doc("approved")

        resp = self._review(self.reviewers["Dean"], doc, "return", reasons=())

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("reasons", resp.data)
        doc.refresh_from_db()
        self.assertEqual(doc.status.code, "approved")

    def test_foreign_scope_403(self):
        for role, reviewer in self.foreign.items():
            with self.subTest(role=role):
                doc = self._doc("approved")

                resp = self._review(reviewer, doc, "reject")

                self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
                doc.refresh_from_db()
                self.assertEqual(doc.status.code, "approved")

    def test_stale_document_rechecked_in_db(self):
        # Два модератора решают одновременно: решение второго проверяется по статусу в БД,
        # а не по объекту, загруженному до решения первого (иначе баллы спишутся дважды).
        doc = self._doc("approved")
        stale = Document.objects.get(pk=doc.pk)
        review_document(document=doc, reviewer=self.reviewers["Dean"], action="reject", reasons=[REASON])
        before = self._score()

        with self.assertRaises(InvalidDocumentState):
            review_document(document=stale, reviewer=self.reviewers["Rectorate"], action="reject", reasons=[REASON])

        self.assertEqual(self._score(), before)
        stale.refresh_from_db()
        self.assertEqual(stale.status.code, "rejected")

    def test_audit_line_has_transition_and_score(self):
        doc = self._doc("approved")

        with self.assertLogs("audit", level="INFO") as logs:
            self._review(self.reviewers["Dean"], doc, "return")

        line = logs.output[-1]
        self.assertIn(f"doc={doc.pk}", line)
        self.assertIn(f"reviewer={self.reviewers['Dean'].pk}", line)
        self.assertIn("action=return", line)
        self.assertIn("from=approved to=pending", line)
        self.assertIn(f"points=-{SCORE}", line)

    def _pending_item(self, doc):
        self.client.force_authenticate(self.reviewers["Department"])
        resp = self.client.get(reverse(LIST), {"list_type": "pending"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        return next(item for item in resp.data["results"] if item["id"] == str(doc.public_id))

    def test_returned_by_mark_in_department_list(self):
        for role, start in (("Dean", "approved"), ("Rectorate", "rejected")):
            with self.subTest(role=role):
                doc = self._doc(start)

                self._review(self.reviewers[role], doc, "return")

                self.assertEqual(self._pending_item(doc)["returned_by"], role)

    def test_resubmitted_has_no_returned_by_mark(self):
        # Отклонённую (кафедрой или руководством) исправил студент — это «Повторно», а не возврат.
        for role in ("Department", "Dean"):
            with self.subTest(role=role):
                doc = self._doc("approved")
                self._review(self.reviewers[role], doc, "reject")
                self.client.force_authenticate(self.student)
                self.client.patch(reverse("api:achievements-detail", args=[doc.public_id]), {"achievement": "исправлено"})

                item = self._pending_item(doc)

                self.assertIsNone(item["returned_by"])
                self.assertEqual(item["rejection_reason"], REASON)

    def test_new_request_has_no_returned_by_mark(self):
        doc = self._doc("pending")

        self.assertIsNone(self._pending_item(doc)["returned_by"])

    def test_staff_cannot_review_own_request(self):
        # ЭОС может дать одной учётке и профиль студента, и профиль сотрудника кафедры.
        self.student.groups.add(AuthGroup.objects.get(name="Department"))
        Staff.objects.create(user=self.student, department=self.dept, faculty=self.dept.faculty)
        doc = self._doc("pending")

        resp = self._review(self.student, doc, "approve")

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        doc.refresh_from_db()
        self.assertEqual(doc.status.code, "pending")

    def test_broadest_role_wins_for_several_groups(self):
        # Кафедра + деканат: область видимости - факультет (core/scoping), значит и права
        # руководства; иначе сотрудник одобрял бы заявки всего факультета в обход кафедр.
        both = make_staff("kaf-dean", "Department", department=self.dept)
        both.groups.add(AuthGroup.objects.get(name="Dean"))
        pending, approved = self._doc("pending"), self._doc("approved")

        resp = self._review(both, pending, "approve")

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        resp = self.client.get(reverse(LIST), {"list_type": "pending"})
        self.assertEqual({item["id"] for item in resp.data["results"]}, {str(approved.public_id)})

    def test_rectorate_mark_wins_over_dean(self):
        both = make_staff("dean-rector", "Dean", faculty=self.dept.faculty)
        both.groups.add(AuthGroup.objects.get(name="Rectorate"))
        doc = self._doc("approved")

        self._review(both, doc, "return")

        self.assertEqual(self._pending_item(doc)["returned_by"], "Rectorate")

    def test_student_edit_after_approval_is_refused(self):
        # Студент открыл правку отклонённой, кафедра тем временем одобрила: правка не должна
        # вернуть заявку в pending с уже начисленными баллами.
        doc = self._doc("rejected")
        stale = Document.objects.get(pk=doc.pk)
        review_document(document=doc, reviewer=self.reviewers["Department"], action="approve")
        before = self._score()

        with self.assertRaises(PermissionDenied):
            update_achievement(stale, {"achievement": "исправлено"})

        doc.refresh_from_db()
        self.assertEqual(doc.status.code, "approved")
        self.assertNotEqual(doc.achievement, "исправлено")
        self.assertEqual(self._score(), before)

    def test_student_edit_keeps_leadership_return(self):
        doc = self._doc("rejected")
        stale = Document.objects.get(pk=doc.pk)
        review_document(document=doc, reviewer=self.reviewers["Dean"], action="return", reasons=[REASON])

        update_achievement(stale, {"achievement": "исправлено"})

        doc.refresh_from_db()
        self.assertEqual(doc.status.code, "pending")
        self.assertEqual(doc.verified_by, self.reviewers["Dean"])
        self.assertEqual(doc.rejection_reason, REASON)
        self.assertEqual(doc.achievement, "исправлено")

    def test_student_delete_after_approval_is_refused(self):
        doc = self._doc("pending")
        stale = Document.objects.get(pk=doc.pk)
        review_document(document=doc, reviewer=self.reviewers["Department"], action="approve")

        with self.assertRaises(PermissionDenied):
            delete_achievement(stale)

        self.assertTrue(Document.objects.filter(pk=doc.pk).exists())

    def test_debit_returns_what_was_credited(self):
        # Правило баллов поменяли, пока заявка подтверждена: списать нужно ровно начисленное
        # (save() пересчитывает балл, поэтому списание идёт до него). Вторая заявка - чтобы
        # лишнее списание не спряталось за обрезкой баллов на нуле.
        self._doc("approved")
        doc = self._doc("approved")
        before = self._score()
        ScoringRule.objects.filter(achievement_type=self.catalog.sub_type).update(score=SCORE * 3)

        review_document(document=doc, reviewer=self.reviewers["Department"], action="reject", reasons=[REASON])

        self.assertEqual(self._score(), before - SCORE)

    def test_combined_reasons_too_long_400(self):
        # Готовые причины и комментарий складываются через «; » в поле на 500 символов:
        # без проверки длины сервер падал с 500 (DataError), а не объяснял, что не так.
        doc = self._doc("pending")

        resp = self._review(self.reviewers["Department"], doc, "reject", reasons=["а" * 300, "б" * 300])

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("reasons", resp.data)
        doc.refresh_from_db()
        self.assertEqual(doc.status.code, "pending")

    def test_refusal_uses_cabinet_words(self):
        # В кабинете решение называется «Одобрить / Одобрена», а не меткой статуса из БД.
        doc = self._doc("approved")

        resp = self._review(self.reviewers["Department"], doc, "approve")

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("«Одобрена»", str(resp.data["detail"]))

