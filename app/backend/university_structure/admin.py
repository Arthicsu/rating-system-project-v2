from django.contrib import admin, messages
from django.db import transaction
from django.contrib.auth.models import Group as DjangoGroup

from core.admin_import_csv import CsvImport
from core.eos.admin_mixin import EosSyncActionsMixin
from core.eos.syncers import FacultySyncer, DepartmentSyncer, GroupSyncer

from students.services import rollover_semester
from users.models import User
from .models import Faculty, Department, Group, Staff, Specialty, RejectionReason, AcademicYear


@admin.register(Staff)
class StaffAdmin(admin.ModelAdmin, CsvImport, EosSyncActionsMixin):
    list_display = ('email', 'get_roles', 'department', 'faculty')
    list_filter = ('faculty', 'department', 'user__groups')
    search_fields = ('email', 'department__name', 'faculty__name')
    raw_id_fields = ('user', 'department', 'faculty')
    change_list_template = "admin/import_actions.html"
    actions = []

    def get_roles(self, obj):
        return ", ".join([group.name for group in obj.user.groups.all()])
    get_roles.short_description = 'Роли (Группы)'

    def get_urls(self):
        return self.get_import_urls() + self.get_eos_urls() + super().get_urls()

    def process_import_csv(self, request, data):
        imported = 0
        with transaction.atomic():
            g_dept, _ = DjangoGroup.objects.get_or_create(name='Department')
            g_dean, _ = DjangoGroup.objects.get_or_create(name='Dean')
            g_rector, _ = DjangoGroup.objects.get_or_create(name='Rectorate')

            # Сотрудники
            for row in data:
                username = row.get('username')
                if not username:
                    messages.warning(request, "Пропущена строка: нет 'username'.")
                    continue
                user, created = User.objects.update_or_create(
                    username=username,
                    defaults={
                        "first_name": row.get('first_name', ''),
                        "last_name": row.get('last_name', ''),
                        "patronymic": row.get('patronymic', ''),
                        "is_staff": True,
                    }
                )
                if created:
                    user.set_password(row.get('password'))
                    user.save()

                user.groups.clear()
                role_input = row.get('role', '')
                if role_input == 'Декан':
                    user.groups.add(g_dean)
                elif role_input == 'Ректорат':
                    user.groups.add(g_rector)
                else:
                    user.groups.add(g_dept)

                department = Department.objects.filter(external_id=row.get('department_id')).first()
                faculty = Faculty.objects.filter(external_id=row.get('faculty_id')).first()
                if department and not faculty:
                    faculty = department.faculty

                Staff.objects.update_or_create(
                    user=user,
                    defaults={
                        "email": row.get('email', '-'),
                        "department": department,
                        "faculty": faculty,
                        "phone": row.get('phone', '-'),
                    }
                )
                imported += 1
        return imported

    def get_full_name(self, obj):
        return obj.user.get_full_username()
    get_full_name.short_description = 'ФИО'


@admin.register(Faculty)
class FacultyAdmin(admin.ModelAdmin, CsvImport, EosSyncActionsMixin):
    list_display = ('external_id', 'short_name', 'name', 'alias', 'dean_name', 'phone')
    search_fields = ('short_name', 'name')
    eos_syncer_class = FacultySyncer
    eos_sync_all = True
    change_list_template = "admin/import_actions.html"
    actions = []

    def get_urls(self):
        return self.get_import_urls() + self.get_eos_urls() + super().get_urls()

    def process_import_csv(self, request, data):
        imported = 0
        with transaction.atomic():
            for row in data:
                ext_id = row.get('Код')
                if not ext_id:
                    messages.warning(request, "Пропущена строка: нет поля 'Код'.")
                    continue
                Faculty.objects.update_or_create(
                    external_id=ext_id,
                    defaults={
                        'name': row.get('Факультет'),
                        'short_name': row.get('Сокращение'),
                        'alias': row.get('Псевдоним'),
                        'dean_name': row.get('Декан'),
                        'phone': row.get('Телефон', '-'),
                        'email': row.get('EMail', '-'),
                    }
                )
                imported += 1
        return imported

@admin.register(Specialty)
class SpecialtyAdmin(admin.ModelAdmin, CsvImport):
    list_display = ('external_id', 'code_fgos', 'name', 'faculty', 'department')
    list_filter = ['faculty', 'department']
    search_fields = ['external_id', 'code_fgos', 'name']
    raw_id_fields = ('faculty', 'department')
    change_list_template = "admin/import_actions.html"

    def get_urls(self):
        return self.get_import_urls() + super().get_urls()

    def process_import_csv(self, request, data):
        imported = 0
        with transaction.atomic():
            for row in data:
                ext_id = row.get('Код')
                dep_code = row.get('Код_Кафедры')
                fac_code = row.get('Код_Факультета')
                code_fgos = row.get('Код_по_ФГОС')
                name = row.get('Название_Спец')

                if not all([ext_id, dep_code, fac_code, code_fgos, name]):
                    messages.warning(request, f"Пропущена строка с ext_id={ext_id}: не хватает обязательных полей.")
                    continue

                faculty = Faculty.objects.filter(external_id=fac_code).first()
                department = Department.objects.filter(external_id=dep_code).first()

                if not faculty or not department:
                    messages.warning(request, f"Пропущен код {ext_id}: не найден факультет '{fac_code}' или кафедра '{dep_code}'.")
                    continue
                
                Specialty.objects.update_or_create(
                    external_id=ext_id,
                    defaults={
                        'code_fgos': code_fgos,
                        'name': name,
                        'short_name': row.get('Краткое_название', ''),
                        'faculty': faculty,
                        'department': department,
                        'qualification': row.get('Квалификация', '-'),
                        'specialty_type': row.get('Специальность', '-'),
                        'prefix': row.get('Префикс', '-'),
                        'parent_code': row.get('КодРодителя', '-')
                    }
                )
                imported += 1
        return imported

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin, CsvImport, EosSyncActionsMixin):
    list_display = ('external_id', 'short_name', 'name', 'faculty', 'head_name')
    list_filter = ('faculty',)
    raw_id_fields = ('faculty',)
    eos_syncer_class = DepartmentSyncer
    eos_sync_all = True
    change_list_template = "admin/import_actions.html"
    actions = []

    def get_urls(self):
        return self.get_import_urls() + self.get_eos_urls() + super().get_urls()

    def process_import_csv(self, request, data):
        imported = 0
        with transaction.atomic():
            for row in data:
                ext_id = row.get('Код')
                if not ext_id:
                    messages.warning(request, "Пропущена строка: нет поля 'Код'.")
                    continue
                def clean_val(key):
                    val = str(row.get(key, '')).strip()
                    return 0 if val.upper() == 'NULL' else val
                status = clean_val('Удалена')
                if status == 1:
                    continue
                fac_code = row.get('Код_Факультета')
                faculty = Faculty.objects.filter(external_id=fac_code).first()
                if fac_code and not faculty:
                    messages.warning(request, f"Пропущена кафедра {ext_id}: не найден факультет '{fac_code}'.")
                    continue
                Department.objects.update_or_create(
                    external_id=ext_id,
                    defaults={
                        'name': row.get('Название'),
                        'short_name': row.get('Сокращение'),
                        'faculty': faculty,
                        'phone': row.get('Телефон', '-'),
                        'head_name': row.get('ЗавКафедрой', '-'),
                        'status': status
                    }
                )
                imported += 1
        return imported


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin, CsvImport, EosSyncActionsMixin):
    list_display = ('external_id', 'name', 'get_faculty', 'get_department', 'get_specialty', 'course', 'education_form_decode', 'academic_year')
    list_filter = ('specialty__faculty', 'specialty__department', 'course', 'education_form_decode', 'academic_year')
    search_fields = ('external_id', 'name')
    raw_id_fields = ('specialty',)
    eos_syncer_class = GroupSyncer
    eos_sync_all = True
    change_list_template = "admin/import_actions.html"
    actions = []

    def get_faculty(self, obj):
        return obj.specialty.faculty if obj.specialty else "-"
    get_faculty.short_description = "Факультет"

    def get_specialty(self, obj):
        return obj.specialty if obj.specialty else "-"
    get_specialty.short_description = "Специальность"

    def get_department(self, obj):
        return obj.specialty.department if obj.specialty else "-"
    get_department.short_description = "Кафедра"

    def get_urls(self):
        return self.get_import_urls() + self.get_eos_urls() + super().get_urls()

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        return queryset.select_related('specialty', 'specialty__faculty', 'specialty__department')

    def process_import_csv(self, request, data):
        imported = 0
        faculties = {f.external_id: f for f in Faculty.objects.all()}
        with transaction.atomic():
            for row in data:
                ext_id = row.get('Код')
                if not ext_id:
                    messages.warning(request, "Пропущена строка: нет поля 'Код'.")
                    continue

                spec_code = row.get('Код_специальности')
                specialty = Specialty.objects.filter(external_id=spec_code).first()
                
                if not specialty:
                    messages.warning(request, f"Пропущена группа {ext_id}: специальность '{spec_code}' не найдена.")
                    continue

                def clean_val(key):
                    val = str(row.get(key, '')).strip()
                    return 0 if val.upper() == 'NULL' else val
                status = clean_val('Удалена')
                if status == 1:
                    continue

                academic_year = row.get('Учебныйгод', '-')
                # if academic_year not in ('2025-2026', '2026-2027'):
                #     messages.warning(request, f"Пропущена группа {ext_id}: учебный год '{academic_year}' вне допустимого диапазона.")
                #     continue

                Group.objects.update_or_create(
                    external_id=ext_id,
                    defaults={
                        'name': row.get('Название'),
                        'specialty': specialty,
                        'course': row.get('Курс', 1),
                        'academic_year': academic_year,
                        'education_duration': row.get('СрокОбучения'),
                        'education_level': row.get('Уровень', '-'),
                        'education_level_decode': row.get('Название_Уровня', ''),
                        'education_form': row.get('Форма_Обучения', '-'),
                        'education_form_decode': row.get('Название_Формы_Обучения', ''),
                    }
                )
                imported += 1
        return imported


@admin.register(RejectionReason)
class RejectionReasonAdmin(admin.ModelAdmin):
    list_display = ('text', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('text',)


@admin.register(AcademicYear)
class AcademicYearAdmin(admin.ModelAdmin):
    list_display = ('label', 'start_date', 'end_date', 'is_current')
    list_filter = ('is_current',)
    search_fields = ('label',)
    actions = ['rollover_to_selected']

    @admin.action(description="Завершить текущий семестр и активировать выбранный (ролловер)")
    def rollover_to_selected(self, request, queryset):
        """
        Ролловер семестра: обнуляет живые баллы студентов (история сохраняется в
        SemesterScore) и делает выбранный период текущим. Нужно выбрать ровно один период.
        """
        if queryset.count() != 1:
            self.message_user(request, "Выберите ровно один семестр для активации.", level=messages.ERROR)
            return
        target = queryset.first()
        result = rollover_semester(to_semester=target)
        self.message_user(
            request,
            f"Ролловер выполнен: архивирован «{result['archived']}», активирован «{result['activated']}», "
            f"сброшено студентов: {result['students_reset']}, строк истории: {result['snapshots']}.",
            level=messages.SUCCESS,
        )
