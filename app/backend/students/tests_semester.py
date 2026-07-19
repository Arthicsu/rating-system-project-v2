"""
Тесты посеместрового учёта баллов: начисление/списание в разрезе семестра,
ролловер (обнуление + сохранение истории), исторический рейтинг и привязка заявки к семестру.
"""
import io
import zipfile
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
        # Рейтинг доступен только сотрудникам — API-проверки ходят от этого пользователя.
        self.staff_user = User.objects.create_user(username="staff@uni.ru", password="pass12345")
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
        self.client.force_authenticate(self.staff_user)

        resp = self.client.get(reverse("api:rating-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        me = next(r for r in resp.data["results"] if r["id"] == self.student.id)
        self.assertEqual(me["total_score"], 10)

    def test_rating_api_past_semester_returns_history(self):
        credit_document(self._doc(self.fall))
        rollover_semester()  # осень -> история, весна текущая, кэш обнулён
        cache.clear()
        self.client.force_authenticate(self.staff_user)

        # Прошлый семестр: баллы из истории SemesterScore, а не из живого кэша.
        resp = self.client.get(reverse("api:rating-list"), {"semester": self.fall.id})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        me = next(r for r in resp.data["results"] if r["id"] == self.student.id)
        self.assertEqual(me["total_score"], 10)

        # Без параметра — текущий семестр (весна), баллов ещё нет.
        resp = self.client.get(reverse("api:rating-list"))
        me = next(r for r in resp.data["results"] if r["id"] == self.student.id)
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
        rollover_semester()  # живой кэш обнулён — в файле должна быть история
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

    def test_upload_stamps_current_semester(self):
        self.client.force_authenticate(self.user)
        png = SimpleUploadedFile("proof.png", PNG, content_type="image/png")

        resp = self.client.post(
            reverse("api:achievements-list"),
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

    def test_switching_current_semester_resets_cache_and_no_accumulation(self):
        # В осеннем (текущем) семестре начислены баллы.
        credit_document(self._doc(self.fall))
        self.student.refresh_from_db()
        self.assertEqual(self.student.total_score, 10)

        # Смена текущего семестра на весенний (как ручное переключение в админке) —
        # сигнал пересобирает кэш из SemesterScore нового текущего (строк нет → 0).
        self._make_current(self.spring)
        self.student.refresh_from_db()
        self.assertEqual(self.student.total_score, 0)
        # История осени сохранена.
        self.assertEqual(
            SemesterScore.objects.get(student=self.student, semester=self.fall).total_score, 10
        )

        # Подтверждение в новом семестре НЕ суммируется со старым (регресс бага «Рощина»).
        credit_document(self._doc(self.spring))
        self.student.refresh_from_db()
        self.assertEqual(self.student.total_score, 10)
        self.assertEqual(
            SemesterScore.objects.get(student=self.student, semester=self.spring).total_score, 10
        )

    def test_switching_back_restores_previous_semester_scores(self):
        credit_document(self._doc(self.fall))    # осень = 10
        self._make_current(self.spring)
        credit_document(self._doc(self.spring))  # весна = 10

        # Возврат на осень восстанавливает её баллы в живом кэше.
        self._make_current(self.fall)
        self.student.refresh_from_db()
        self.assertEqual(self.student.total_score, 10)
        # Весенняя история сохранена.
        self.assertEqual(
            SemesterScore.objects.get(student=self.student, semester=self.spring).total_score, 10
        )
