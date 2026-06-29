"""
Синхронизаторы справочников из ЭОС в локальную БД.
Логика: fetch data -> upsert построчно в одной транзакции -> статистика.
Реализации на каждый справочник.
Маппинг полей повторяет логику csv-импорта из `university_structure/admin.py`, но источник уже публичный api эос
"""
from dataclasses import dataclass, field

from django.db import transaction
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group as DjangoGroup

from university_structure.models import Faculty, Department, Group
from students.models import Student
from .client import EOSClient


@dataclass
class SyncStats:
    entity: str
    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: list = field(default_factory=list)

    def bump(self, created: bool):
        if created:
            self.created += 1
        else:
            self.updated += 1

    @property
    def ok(self) -> bool:
        return not self.errors

    def as_message(self) -> str:
        return (f"{self.entity}: создано {self.created}, обновлено {self.updated}, "
                f"пропущено {self.skipped}, ошибок {len(self.errors)}")


class BaseSyncer:
    entity = ""

    def __init__(self, client=None):
        self.client = client or EOSClient()
        self.stats = SyncStats(entity=self.entity)

    def fetch(self):
        raise NotImplementedError

    def upsert(self, item):
        """True — создано, False — обновлено, None — пропущено."""
        raise NotImplementedError

    def run(self) -> SyncStats:
        items = self.fetch()
        with transaction.atomic():
            for item in items:
                try:
                    result = self.upsert(item)
                    if result is None:
                        self.stats.skipped += 1
                    else:
                        self.stats.bump(result)
                except Exception as e:
                    self.stats.errors.append(f"{self._ident(item)}: {e}")
        return self.stats

    @staticmethod
    def _ident(item):
        if isinstance(item, dict):
            return (item.get("facultyID") or item.get("kafedraID") or item.get("groupID")
                    or item.get("studentID") or item)
        return item


class FacultySyncer(BaseSyncer):
    entity = "Факультеты"

    def fetch(self):
        return self.client.get_faculties()

    def upsert(self, item):
        ext = item.get("facultyID")
        if not ext:
            return None
        # alias/email/subdivision_type в ЭОС нет — не трогаем (сохраняем существующее).
        _, created = Faculty.objects.update_or_create(
            external_id=str(ext),
            defaults={
                "name": item.get("facultyName") or "",
                "short_name": (item.get("facultyShortName") or "")[:20],
                "dean_name": item.get("dekan") or "",
                "phone": item.get("phoneNumber") or "",
            },
        )
        return created


class DepartmentSyncer(BaseSyncer):
    entity = "Кафедры"

    def __init__(self, client=None):
        super().__init__(client)
        self._faculties = {f.external_id: f for f in Faculty.objects.all()}

    def fetch(self):
        return self.client.get_departments()

    def upsert(self, item):
        ext = item.get("kafedraID")
        if not ext:
            return None
        faculty = self._faculties.get(str(item.get("faculID")))
        _, created = Department.objects.update_or_create(
            external_id=str(ext),
            defaults={
                "name": item.get("kafedraName") or "",
                "short_name": (item.get("kafedraShortName") or "")[:20],
                "head_name": item.get("kafedraZav") or "",
                "phone": item.get("kafedraPhone") or "",
                "faculty": faculty,
                "status": 1 if item.get("isDeleted") else 0,
            },
        )
        return created


class GroupSyncer(BaseSyncer):
    entity = "Группы"

    def __init__(self, client=None):
        super().__init__(client)
        self._faculties = {f.external_id: f for f in Faculty.objects.all()}
        # "Очная форма" -> "1" (для education_form). Если справочник недоступен — пропускаем код формы.
        self._forms = {}
        try:
            for f in self.client.get_form_study():
                name = (f.get("name") or "").strip()
                if name:
                    self._forms[name] = str(f.get("id"))
        except Exception:
            self._forms = {}

    def fetch(self):
        return self.client.get_groups()

    def upsert(self, item):
        ext = item.get("groupID")
        if not ext:
            return None
        form_decode = (item.get("form") or "").strip()
        defaults = {
            "name": (item.get("groupName") or "")[:50],
            "course": item.get("course") or 1,
            "academic_year": item.get("year") or "",
            "education_form_decode": form_decode,
            "faculty": self._faculties.get(str(item.get("facultyID"))),
        }
        form_code = self._forms.get(form_decode)
        if form_code:
            defaults["education_form"] = form_code[:5]
        # education_level/decode и education_duration GroupsList не отдаёт — не трогаем.
        _, created = Group.objects.update_or_create(
            external_id=str(ext),
            defaults=defaults,
        )
        return created


class StudentSyncer(BaseSyncer):
    """ЭКСПЕРИМЕНТАЛЬНО: синк студентов из ЗАКРЫТОЙ ручки students/list (нужен EOS_AUTH_TOKEN).

    Точная структура ответа неизвестна — поля берём защитно из формы UserInfo/Student.
    Новым пользователям ставим set_unusable_password() (вход позже через привязку аккаунта),
    что заодно убирает дорогое хеширование пароля при массовом импорте.
    Кафедра/факультет/группа берутся напрямую из карточки студента (kaf/facul/group).
    """
    entity = "Студенты"

    def __init__(self, client=None):
        super().__init__(client)
        self.User = get_user_model()
        self._faculties = {f.external_id: f for f in Faculty.objects.all()}
        self._departments = {d.external_id: d for d in Department.objects.all()}
        self._groups = {g.external_id: g for g in Group.objects.all()}
        self._student_group, _ = DjangoGroup.objects.get_or_create(name="Student")

    def fetch(self):
        return self.client.get_students()

    @staticmethod
    def _nested_id(item, key, id_field):
        return str((item.get(key) or {}).get(id_field) or "")

    def upsert(self, item):
        ext = item.get("studentID")
        if not ext:
            return None
        ext = str(ext)

        group = self._groups.get(self._nested_id(item, "group", "item2"))
        faculty = self._faculties.get(self._nested_id(item, "facul", "faculID"))
        department = self._departments.get(self._nested_id(item, "kaf", "kafID"))
        email = item.get("email") or item.get("login") or ""
        admission_raw = str(item.get("admissionYear") or "")
        admission_year = int(admission_raw) if admission_raw.isdigit() else None

        student = Student.objects.filter(external_id=ext).select_related("user").first()
        if student and student.user_id:
            user = student.user
        else:
            username = email or f"student_{ext}@bgitu.ru"
            user, user_created = self.User.objects.get_or_create(
                username=username,
                defaults={
                    "first_name": item.get("name") or "",
                    "last_name": item.get("surname") or "",
                    "patronymic": item.get("middleName") or "",
                },
            )
            if user_created:
                user.set_unusable_password()
                user.save(update_fields=["password"])
            user.groups.add(self._student_group)

        _, created = Student.objects.update_or_create(
            external_id=ext,
            defaults={
                "user": user,
                "full_name": item.get("fullName") or user.get_full_name() or "",
                "group": group,
                "faculty": faculty,
                "department": department,
                "email": email,
                "record_book": item.get("numRecordBook") or "",
                "status": str(item.get("status") or 1),
                "admission_year": admission_year,
            },
        )
        return created


def run_all(client=None):
    """Синхронизация всех справочников в порядке зависимостей (факультеты -> кафедры -> группы).

    Каждый шаг — своя транзакция и своя статистика. Карты факультетов в кафедрах/группах
    строятся в их __init__, который вызывается ПОСЛЕ завершения FacultySyncer.run().
    """
    client = client or EOSClient()
    results = [FacultySyncer(client).run()]
    results.append(DepartmentSyncer(client).run())
    results.append(GroupSyncer(client).run())
    return results
