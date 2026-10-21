"""
Общие фабрики тестовых данных и настройки изоляции для тестов всех приложений.

Приложение этот модуль не импортирует - только тесты. Раньше каждый файл тестов
собирал роли, структуру вуза и заявки вручную; новые тесты берут всё отсюда.
"""
from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group as AuthGroup
from django.utils import timezone

from students.models import (
    AchievementType,
    Category,
    DocType,
    Document,
    DocumentStatus,
    ScoringRule,
    Student,
)
from university_structure.models import AcademicYear, Department, Faculty, Group, Specialty, Staff

User = get_user_model()

# locmem-кэш (он же бэкенд сессий) + быстрый хешер: тесты не зависят от живого Redis
# и не тратят по полсекунды на PBKDF2 при каждом create_user.
TEST_SETTINGS = {
    "CACHES": {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "tests",
        }
    },
    "PASSWORD_HASHERS": ["django.contrib.auth.hashers.MD5PasswordHasher"],
}

# То же + файлы в памяти вместо SeaweedFS.
FILE_TEST_SETTINGS = {
    **TEST_SETTINGS,
    "STORAGES": {
        "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    },
}

DEFAULT_PASSWORD = "pass12345"


def make_statuses():
    """Справочник статусов заявки: {'pending': ..., 'approved': ..., 'rejected': ...}."""
    labels = {"pending": "На рассмотрении", "approved": "Подтверждено", "rejected": "Отклонено"}
    return {
        code: DocumentStatus.objects.get_or_create(code=code, defaults={"label": label})[0]
        for code, label in labels.items()
    }


def make_catalog(score=10):
    """Категория academic / подтип olympiad / тип документа other и правило на `score` баллов."""
    category, _ = Category.objects.get_or_create(code="academic", defaults={"label": "Учебная"})
    sub_type, _ = AchievementType.objects.get_or_create(
        category=category, code="olympiad", defaults={"label": "Олимпиада"}
    )
    doc_type, _ = DocType.objects.get_or_create(code="other", defaults={"label": "Другое"})
    ScoringRule.objects.get_or_create(
        achievement_type=sub_type, level=None, result=None, defaults={"score": score}
    )
    return SimpleNamespace(category=category, sub_type=sub_type, doc_type=doc_type)


def make_department(code, faculty=None):
    """Кафедра `code`; без факультета создаётся свой `F-<code>`."""
    if faculty is None:
        faculty = Faculty.objects.create(
            external_id=f"F-{code}", name=f"Факультет {code}", short_name=f"F-{code}"
        )
    return Department.objects.create(
        external_id=f"D-{code}", name=f"Кафедра {code}", short_name=code, faculty=faculty
    )


def make_group(department, code, course=1):
    """
    Группа кафедры. Кафедра видит студента через цепочку группа -> специальность ->
    кафедра (core/scoping.scope_queryset), поэтому строится полная цепочка.
    """
    specialty = Specialty.objects.create(
        external_id=f"SP-{code}",
        code_fgos="09.03.01",
        name=f"Специальность {code}",
        faculty=department.faculty,
        department=department,
    )
    return Group.objects.create(
        external_id=f"G-{code}", name=code, specialty=specialty,
        course=course, academic_year="2025-2026",
        education_level="-", education_level_decode="",
        education_form="-", education_form_decode="",
    )


def make_student(username, *, group=None, email=None, archived=False, password=DEFAULT_PASSWORD):
    """
    Пользователь-студент с профилем Student. Факультет и кафедра берутся из группы.
    password=None - неиспользуемый пароль (как у импортированного студента).
    """
    user = User.objects.create_user(
        username=username, email=email if email is not None else username, password=password
    )
    user.groups.add(AuthGroup.objects.get_or_create(name="Student")[0])

    department = group.specialty.department if group and group.specialty else None
    Student.objects.create(
        user=user,
        external_id=f"EXT-{username}",
        full_name=username,
        record_book=f"RB-{username}",
        email=user.email,
        group=group,
        faculty=department.faculty if department else None,
        department=department,
        archived_at=timezone.now() if archived else None,
    )
    return user


def make_staff(username, role, *, department=None, faculty=None):
    """Сотрудник с ролью Department / Dean / Rectorate; доступа в Django-админку нет."""
    if role not in ("Department", "Dean", "Rectorate"):
        raise ValueError(f"Неизвестная роль сотрудника: {role}")
    user = User.objects.create_user(username=username, password=DEFAULT_PASSWORD)
    user.groups.add(AuthGroup.objects.get_or_create(name=role)[0])
    if department is not None and faculty is None:
        faculty = department.faculty
    Staff.objects.create(user=user, department=department, faculty=faculty)
    return user


def make_doc(user, catalog, status, *, semester=None, achievement="Док", **extra):
    """Заявка студента; балл посчитает Document.save() по правилу каталога."""
    return Document.objects.create(
        user=user,
        category=catalog.category,
        sub_type=catalog.sub_type,
        doc_type=catalog.doc_type,
        status=status,
        semester=semester,
        achievement=achievement,
        **extra,
    )


def make_semester(label, start, end, current=False):
    """Учебный период (семестр). Сигнатура расширится в задаче про учебный год."""
    return AcademicYear.objects.create(label=label, start_date=start, end_date=end, is_current=current)
