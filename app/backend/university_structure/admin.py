from django.contrib import admin
from django.db import transaction
from django.contrib.auth.models import Group as DjangoGroup

from core.admin_import_csv import CsvImport
from core.eos.admin_mixin import EosSyncActionsMixin
from core.eos.syncers import FacultySyncer, DepartmentSyncer, GroupSyncer

from users.models import User
from .models import Faculty, Department, Group, Staff, RejectionReason, AcademicYear


@admin.register(Staff)
class StaffAdmin(admin.ModelAdmin, CsvImport, EosSyncActionsMixin):
    list_display = ('email', 'get_roles', 'department', 'faculty')
    list_filter = ('faculty', 'department', 'user__groups')
    search_fields = ('email', 'department__name', 'faculty__name')
    raw_id_fields = ('user', 'department', 'faculty')
    change_list_template = "admin/csv_import.html"
    actions = ['import_csv_action']

    def get_roles(self, obj):
        return ", ".join([group.name for group in obj.user.groups.all()])
    get_roles.short_description = 'Роли (Группы)'

    def get_urls(self):
        return self.get_import_urls() + super().get_urls()

    def process_import_csv(self, request, data):
        with transaction.atomic():
            g_dept, _ = DjangoGroup.objects.get_or_create(name='Department')
            g_dean, _ = DjangoGroup.objects.get_or_create(name='Dean')
            g_rector, _ = DjangoGroup.objects.get_or_create(name='Rectorate')

            # Сотрудники
            for row in data:
                user, created = User.objects.update_or_create(
                    username=row['username'],
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

    def get_full_name(self, obj):
        return obj.user.get_full_username()
    get_full_name.short_description = 'ФИО'


@admin.register(Faculty)
class FacultyAdmin(admin.ModelAdmin, CsvImport, EosSyncActionsMixin):
    list_display = ('external_id', 'short_name', 'name', 'alias', 'dean_name', 'phone')
    search_fields = ('short_name', 'name')
    eos_syncer_class = FacultySyncer
    change_list_template = "admin/csv_import.html"
    actions = ['import_csv_action', 'sync_eos_action', 'sync_eos_all_action']

    def get_urls(self):
        return self.get_import_urls() + super().get_urls()

    def process_import_csv(self, request, data):
        with transaction.atomic():
            for row in data:
                Faculty.objects.update_or_create(
                    external_id=row.get('Код'),
                    defaults={
                        'name': row.get('Факультет'),
                        'short_name': row.get('Сокращение'),
                        'alias': row.get('Псевдоним'),
                        'dean_name': row.get('Декан'),
                        'phone': row.get('Телефон', '-'),
                        'email': row.get('EMail', '-'),
                    }
                )


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin, CsvImport, EosSyncActionsMixin):
    list_display = ('external_id', 'short_name', 'name', 'faculty', 'head_name')
    list_filter = ('faculty',)
    raw_id_fields = ('faculty',)
    eos_syncer_class = DepartmentSyncer
    change_list_template = "admin/csv_import.html"
    actions = ['import_csv_action', 'sync_eos_action', 'sync_eos_all_action']

    def get_urls(self):
        return self.get_import_urls() + super().get_urls()

    def process_import_csv(self, request, data):
        with transaction.atomic():
            for row in data:
                def clean_val(key):
                    val = str(row.get(key, '')).strip()
                    return 0 if val.upper() == 'NULL' else val
                status = clean_val('Удалена')
                if status == 1:
                    continue
                faculty = Faculty.objects.filter(external_id=row.get('Код_Факультета')).first()
                Department.objects.update_or_create(
                    external_id=row.get('Код'),
                    defaults={
                        'name': row.get('Название'),
                        'short_name': row.get('Сокращение'),
                        'faculty': faculty,
                        'phone': row.get('Телефон', '-'),
                        'head_name': row.get('ЗавКафедрой', '-'),
                        'status': status
                    }
                )


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin, CsvImport, EosSyncActionsMixin):
    list_display = ('external_id', 'name', 'get_faculty', 'course', 'education_form_decode', 'academic_year')
    list_filter = ('faculty', 'course', 'education_form_decode', 'academic_year')
    search_fields = ('external_id', 'name')
    raw_id_fields = ('faculty',)
    eos_syncer_class = GroupSyncer
    change_list_template = "admin/csv_import.html"
    actions = ['import_csv_action', 'sync_eos_action', 'sync_eos_all_action']

    def get_faculty(self, obj):
        return obj.faculty or "-"
    get_faculty.short_description = "Факультет"

    def get_urls(self):
        return self.get_import_urls() + super().get_urls()

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('faculty')

    def process_import_csv(self, request, data):
        faculties = {f.external_id: f for f in Faculty.objects.all()}
        with transaction.atomic():
            for row in data:
                def clean_val(key):
                    val = str(row.get(key, '')).strip()
                    return 0 if val.upper() == 'NULL' else val
                status = clean_val('Удалена')
                if status == 1:
                    continue

                academic_year = row.get('Учебныйгод', '-')
                if academic_year not in ('2025-2026', '2026-2027'):
                    continue

                faculty_code = clean_val('Код_Факультета') or clean_val('КодФакультета')
                faculty = faculties.get(faculty_code) if faculty_code else None

                Group.objects.update_or_create(
                    external_id=row.get('Код'),
                    defaults={
                        'name': row.get('Название'),
                        'faculty': faculty,
                        'course': row.get('Курс', 1),
                        'academic_year': academic_year,
                        'education_duration': row.get('СрокОбучения'),
                        'education_level': row.get('Уровень', '-'),
                        'education_level_decode': row.get('Название_Уровня', ''),
                        'education_form': row.get('Форма_Обучения', '-'),
                        'education_form_decode': row.get('Название_Формы_Обучения', ''),
                    }
                )


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
