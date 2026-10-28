"""
Тесты посеместрового учёта баллов: начисление/списание в разрезе семестра, ролловер
(внутри учебного года баллы сохраняются, при смене года - обнуление с сохранением истории)
и исторический рейтинг. Семестр заявки по дате достижения - в tests_academic_year_scoring.
"""
import io
import zipfile

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group as AuthGroup
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from core.testing import make_semester
from students.models import (
    Category, AchievementType, DocType, Document, DocumentStatus, ScoringRule, Student, SemesterScore,
)
from students.services import credit_document, debit_document, rollover_semester
from university_structure.models import AcademicYear, Staff

User = get_user_model()

TEST_SETTINGS = {
    "CACHES": {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "semester-tests",
        }
    },
    "PASSWORD_HASHERS": ["django.contrib.auth.hashers.MD5PasswordHasher"],
}


@override_settings(**TEST_SETTINGS)
class SemesterScoringTests(APITestCase):
    def setUp(self):
        cache.clear()
        # Убираем дефолтный период, созданный data-миграцией, чтобы контролировать состояние.
        AcademicYear.objects.all().delete()

        self.fall = make_semester(2025, "autumn", current=True)
        self.spring = make_semester(2025, "spring")
        self.next_fall = make_semester(2026, "autumn")

        self.pending = DocumentStatus.objects.create(code="pending", label="На рассмотрении")
        self.approved = DocumentStatus.objects.create(code="approved", label="Подтверждено")
        self.rejected = DocumentStatus.objects.create(code="rejected", label="Отклонено")

        self.category = Category.objects.create(code="academic", label="Учебная")
        self.sub_type = AchievementType.objects.create(category=self.category, code="olympiad", label="Олимпиада")
        self.doc_type = DocType.objects.create(code="other", label="Другое")
        ScoringRule.objects.create(achievement_type=self.sub_type, level=None, result=None, score=10)

        self.user = User.objects.create_user(username="stud@uni.ru", password="pass12345")
        self.student = Student.objects.create(
            user=self.user, external_id="EXT-1", full_name="Студент", record_book="RB-1",
        )
        # Рейтинг доступен только сотрудникам — API-проверки ходят от этого пользователя.
        # Ректорат: рейтинг ограничен scope сотрудника, а здесь проверяются семестры, не scope.
        self.staff_user = User.objects.create_user(username="staff@uni.ru", password="pass12345")
        self.staff_user.groups.add(AuthGroup.objects.get_or_create(name="Rectorate")[0])
        Staff.objects.create(user=self.staff_user)

    def _doc(self, semester, status_obj=None):
        return Document.objects.create(
            user=self.user, category=self.category, sub_type=self.sub_type,
            doc_type=self.doc_type, status=status_obj or self.pending,
            achievement="Олимпиада", semester=semester,
        )

    def _make_current(self, semester):
        """Сделать семестр текущим через save() (как в админке) — триггерит сигнал синхронизации."""
        for ay in AcademicYear.objects.filter(is_current=True).exclude(pk=semester.pk):
            ay.is_current = False
            ay.save(update_fields=["is_current"])
        semester.is_current = True
        semester.save(update_fields=["is_current"])
        semester.refresh_from_db()

    def test_credit_updates_semester_row_and_student_cache(self):
        doc = self._doc(self.fall)
        self.assertEqual(doc.score, 10)  # посчитано из ScoringRule в save()

        credit_document(doc)

        ss = SemesterScore.objects.get(student=self.student, semester=self.fall)
        self.assertEqual(ss.academic_score, 10)
        self.assertEqual(ss.total_score, 10)

        self.student.refresh_from_db()
        self.assertEqual(self.student.academic_score, 10)
        self.assertEqual(self.student.total_score, 10)

    def test_debit_reverses_credit(self):
        doc = self._doc(self.fall)
        credit_document(doc)
        debit_document(doc)

        ss = SemesterScore.objects.get(student=self.student, semester=self.fall)
        self.assertEqual(ss.total_score, 0)
        self.student.refresh_from_db()
        self.assertEqual(self.student.total_score, 0)

    def test_late_approval_of_past_year_does_not_touch_current_cache(self):
        # Текущий - следующий учебный год.
        self._make_current(self.next_fall)

        # Заявка относится к прошлому учебному году (осень) и одобряется поздно.
        doc = self._doc(self.fall)
        credit_document(doc)

        ss_fall = SemesterScore.objects.get(student=self.student, semester=self.fall)
        self.assertEqual(ss_fall.total_score, 10)  # история осени изменилась

        self.student.refresh_from_db()
        self.assertEqual(self.student.total_score, 0)  # живой кэш нового года не тронут
        self.assertFalse(SemesterScore.objects.filter(student=self.student, semester=self.next_fall).exists())

    def test_rollover_within_year_keeps_cache_and_activates_next(self):
        doc = self._doc(self.fall)
        credit_document(doc)

        result = rollover_semester()  # авто-выбор следующего по дате = spring того же года

        self.student.refresh_from_db()
        self.assertEqual(self.student.total_score, 10)  # учебный год тот же - баллы на месте

        ss = SemesterScore.objects.get(student=self.student, semester=self.fall)
        self.assertEqual(ss.total_score, 10)  # история сохранена

        self.fall.refresh_from_db()
        self.spring.refresh_from_db()
        self.assertFalse(self.fall.is_current)
        self.assertTrue(self.spring.is_current)
        self.assertEqual(result["activated"], self.spring.label)

    def test_rating_api_current_uses_live_cache(self):
        credit_document(self._doc(self.fall))
        self.client.force_authenticate(self.staff_user)

        resp = self.client.get(reverse("api:rating-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        me = next(r for r in resp.data["results"] if r["id"] == str(self.student.public_id))
        self.assertEqual(me["total_score"], 10)

    def test_rating_api_past_semester_returns_history(self):
        credit_document(self._doc(self.fall))
        rollover_semester(to_semester=self.next_fall)  # новый учебный год, живой кэш обнулён
        cache.clear()
        self.client.force_authenticate(self.staff_user)

        # Прошлый семестр: баллы из истории SemesterScore, а не из живого кэша.
        resp = self.client.get(reverse("api:rating-list"), {"semester": self.fall.id})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        me = next(r for r in resp.data["results"] if r["id"] == str(self.student.public_id))
        self.assertEqual(me["total_score"], 10)

        # Без параметра — текущий учебный год, баллов в нём ещё нет.
        resp = self.client.get(reverse("api:rating-list"))
        me = next(r for r in resp.data["results"] if r["id"] == str(self.student.public_id))
        self.assertEqual(me["total_score"], 0)

    def test_rating_api_direction_asc(self):
        credit_document(self._doc(self.fall))  # у первого студента 10 баллов
        user2 = User.objects.create_user(username="stud2@uni.ru", password="pass12345")
        Student.objects.create(user=user2, external_id="EXT-2", full_name="Второй", record_book="RB-2")
        self.client.force_authenticate(self.staff_user)

        resp = self.client.get(reverse("api:rating-list"), {"direction": "asc"})
        scores = [r["total_score"] for r in resp.data["results"]]
        self.assertEqual(scores, sorted(scores))

        resp = self.client.get(reverse("api:rating-list"))
        scores = [r["total_score"] for r in resp.data["results"]]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_rating_export_past_semester_contains_history(self):
        credit_document(self._doc(self.fall))
        rollover_semester(to_semester=self.next_fall)  # живой кэш обнулён — в файле должна быть история
        self.client.force_authenticate(self.staff_user)

        resp = self.client.get(reverse("api:rating-export"), {"semester": self.fall.id})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("student_rating_", resp["Content-Disposition"])

        # Внутри xlsx: метка периода в строках, балл 10 из истории в данных листа.
        with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
            shared = zf.read("xl/sharedStrings.xml").decode("utf-8")
            sheet = zf.read("xl/worksheets/sheet1.xml").decode("utf-8")
        self.assertIn(self.fall.label, shared)
        self.assertIn(">10<", sheet)

    def test_switching_to_next_year_resets_cache_and_no_accumulation(self):
        # В текущем учебном году (осень) начислены баллы.
        credit_document(self._doc(self.fall))
        self.student.refresh_from_db()
        self.assertEqual(self.student.total_score, 10)

        # Смена текущего на осень следующего года (как ручное переключение в админке) —
        # сигнал пересобирает кэш из SemesterScore нового года (строк нет → 0).
        self._make_current(self.next_fall)
        self.student.refresh_from_db()
        self.assertEqual(self.student.total_score, 0)
        # История осени сохранена.
        self.assertEqual(
            SemesterScore.objects.get(student=self.student, semester=self.fall).total_score, 10
        )

        # Подтверждение в новом году НЕ суммируется со старым (регресс бага «Рощина»).
        credit_document(self._doc(self.next_fall))
        self.student.refresh_from_db()
        self.assertEqual(self.student.total_score, 10)
        self.assertEqual(
            SemesterScore.objects.get(student=self.student, semester=self.next_fall).total_score, 10
        )

    def test_switching_back_restores_previous_year_scores(self):
        credit_document(self._doc(self.fall))       # осень = 10
        credit_document(self._doc(self.spring))     # весна того же года = 10
        self._make_current(self.next_fall)
        credit_document(self._doc(self.next_fall))  # новый год = 10

        # Возврат на прошлый год восстанавливает сумму его семестров в живом кэше.
        self._make_current(self.spring)
        self.student.refresh_from_db()
        self.assertEqual(self.student.total_score, 20)
        # История нового года сохранена.
        self.assertEqual(
            SemesterScore.objects.get(student=self.student, semester=self.next_fall).total_score, 10
        )
