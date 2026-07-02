"""
Тесты посеместрового учёта баллов: начисление/списание в разрезе семестра,
ролловер (обнуление + сохранение истории), исторический рейтинг и привязка заявки к семестру.
"""
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse

from rest_framework import status
from rest_framework.test import APITestCase

from students.models import (
    Category, AchievementType, DocType, Document, DocumentStatus, ScoringRule, Student, SemesterScore,
)
from students.services import credit_document, debit_document, rollover_semester
from university_structure.models import AcademicYear

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

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


@override_settings(**TEST_SETTINGS)
class SemesterScoringTests(APITestCase):
    def setUp(self):
        cache.clear()
        # Убираем дефолтный период, созданный data-миграцией, чтобы контролировать состояние.
        AcademicYear.objects.all().delete()

        today = date.today()
        self.fall = AcademicYear.objects.create(
            label="2025-2026 Осенний", start_date=today - timedelta(days=60),
            end_date=today - timedelta(days=1), is_current=True,
        )
        self.spring = AcademicYear.objects.create(
            label="2025-2026 Весенний", start_date=today,
            end_date=today + timedelta(days=120), is_current=False,
        )

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

    def _doc(self, semester, status_obj=None):
        return Document.objects.create(
            user=self.user, category=self.category, sub_type=self.sub_type,
            doc_type=self.doc_type, status=status_obj or self.pending,
            achievement="Олимпиада", semester=semester,
        )

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

    def test_late_approval_of_past_semester_does_not_touch_current_cache(self):
        # Делаем текущим весенний семестр.
        AcademicYear.objects.update(is_current=False)
        self.spring.is_current = True
        self.spring.save(update_fields=["is_current"])

        # Заявка относится к прошлому (осеннему) семестру и одобряется поздно.
        doc = self._doc(self.fall)
        credit_document(doc)

        ss_fall = SemesterScore.objects.get(student=self.student, semester=self.fall)
        self.assertEqual(ss_fall.total_score, 10)  # история осени изменилась

        self.student.refresh_from_db()
        self.assertEqual(self.student.total_score, 0)  # текущий кэш (весна) не тронут
        self.assertFalse(SemesterScore.objects.filter(student=self.student, semester=self.spring).exists())

    def test_rollover_zeroes_cache_keeps_history_and_activates_next(self):
        doc = self._doc(self.fall)
        credit_document(doc)

        result = rollover_semester()  # авто-выбор следующего по дате = spring

        self.student.refresh_from_db()
        self.assertEqual(self.student.total_score, 0)  # живые баллы обнулены

        ss = SemesterScore.objects.get(student=self.student, semester=self.fall)
        self.assertEqual(ss.total_score, 10)  # история сохранена

        self.fall.refresh_from_db()
        self.spring.refresh_from_db()
        self.assertFalse(self.fall.is_current)
        self.assertTrue(self.spring.is_current)
        self.assertEqual(result["activated"], self.spring.label)

    def test_rating_api_current_uses_live_cache(self):
        credit_document(self._doc(self.fall))
        self.client.force_authenticate(self.user)

        resp = self.client.get(reverse("user:api_v2_student_rating"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        me = next(r for r in resp.data["results"] if r["id"] == self.student.id)
        self.assertEqual(me["total_score"], 10)

    def test_rating_api_past_semester_reads_history(self):
        credit_document(self._doc(self.fall))
        rollover_semester()  # осень -> история, весна текущая, кэш обнулён
        cache.clear()
        self.client.force_authenticate(self.user)

        # Текущий (весна): баллов нет.
        resp_current = self.client.get(reverse("user:api_v2_student_rating"))
        me_current = next(r for r in resp_current.data["results"] if r["id"] == self.student.id)
        self.assertEqual(me_current["total_score"], 0)

        # Прошлый (осень): читается из истории SemesterScore.
        resp_past = self.client.get(reverse("user:api_v2_student_rating"), {"semester": self.fall.id})
        self.assertEqual(resp_past.status_code, status.HTTP_200_OK)
        me_past = next(r for r in resp_past.data["results"] if r["id"] == self.student.id)
        self.assertEqual(me_past["total_score"], 10)

    def test_upload_stamps_current_semester(self):
        self.client.force_authenticate(self.user)
        png = SimpleUploadedFile("proof.png", PNG, content_type="image/png")

        resp = self.client.post(
            reverse("students:api_upload_achievement"),
            data={
                "record_book": "RB-1",
                "category": "academic",
                "sub_type": "olympiad",
                "achievement": "Олимпиада",
                "doc_type": "other",
                "files": [png],
            },
            format="multipart",
        )

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        doc = Document.objects.get(user=self.user)
        self.assertEqual(doc.semester_id, self.fall.id)  # текущий семестр на момент загрузки
