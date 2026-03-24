from django.contrib import admin
from django.db import transaction
from django.contrib.auth.models import Group as DjangoGroup

from core.admin_import_csv import CsvImport
from users.models import User
from .models import Faculty, Department, Group, Staff, Specialty


@admin.register(Staff)
class StaffAdmin(admin.ModelAdmin, CsvImport):
    list_display = ('get_roles', 'department', 'faculty')
    list_filter = ('faculty', 'department', 'user__groups')
    search_fields = ('department__name', 'faculty__name')

    def get_roles(self, obj):
        return ", ".join([group.name for group in obj.user.groups.all()])
    get_roles.short_description = 'Роли (Группы)'

    change_list_template = "admin/staffadmin_change_list.html"

    def get_urls(self):
        urls = super().get_urls()
        return self.get_import_urls() + urls
        
    def process_import_csv(self, data):
        with transaction.atomic():
            # Факультеты
            
            # Кафедры

            # Специальности

            # Группы

            g_dept, _ = DjangoGroup.objects.get_or_create(name='Department')
            g_dean, _ = DjangoGroup.objects.get_or_create(name='Dean')
            g_rector, _ = DjangoGroup.objects.get_or_create(name='Rectorate')

            # Сотрудники
            for staff_data in data.get('staffs', []):
                user, created = User.objects.update_or_create(
                    username=staff_data['username'],
                    defaults={
                        "email": staff_data.get('email', staff_data['username']),
                        "first_name": staff_data.get('first_name', ''),
                        "last_name": staff_data.get('last_name', ''),
                        "patronymic": staff_data.get('patronymic', ''),
                        "is_staff": True, 
                    }
                )
                if created:
                    user.set_password(staff_data.get('password', 'ZAQ123wsx'))
                    user.save()
                
                user.groups.clear()
                role_input = staff_data.get('role', '')
                if role_input == 'Декан':
                    user.groups.add(g_dean)
                elif role_input == 'Ректорат':
                    user.groups.add(g_rector)
                else:
                    user.groups.add(g_dept)
                
                department = Department.objects.filter(external_id=staff_data.get('department_id')).first()
                faculty = Faculty.objects.filter(external_id=staff_data.get('faculty_id')).first()
                if department and not faculty:
                    faculty = department.faculty

                Staff.objects.update_or_create(
                    user=user,
                    defaults={
                        "department": department,
                        "faculty": faculty,
                        "phone": staff_data.get('phone', '-'),
                    }
                )

    def get_full_name(self, obj):
        return obj.user.get_full_username()
    get_full_name.short_description = 'ФИО'

@admin.register(Faculty)
class FacultyAdmin(admin.ModelAdmin, CsvImport):
    list_display = ('external_id', 'short_name', 'name', 'alias', 'dean_name', 'phone')
    search_fields = ('short_name', 'name')
    change_list_template = "admin/faculty_change_list.html"

    def get_urls(self):
        return self.get_import_urls() + super().get_urls()

    def process_import_csv(self, data):
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

@admin.register(Specialty)
class SpecialtyAdmin(admin.ModelAdmin, CsvImport):
    list_display = ('external_id', 'code_fgos', 'name', 'faculty', 'department')
    list_filter = ('faculty', 'department')
    search_fields = ('external_id', 'code_fgos', 'name')
    change_list_template = "admin/specialty_change_list.html"

    def get_urls(self):
        return self.get_import_urls() + super().get_urls()

    def process_import_csv(self, data):
        with transaction.atomic():
            for row in data:
                faculty = Faculty.objects.filter(external_id=row.get('Код_Факультета')).first()
                department = Department.objects.filter(external_id=row.get('Код_Кафедры')).first()
                
                Specialty.objects.update_or_create(
                    external_id=row.get('Код'),
                    defaults={
                        'code_fgos': row.get('Код_по_ФГОС'),
                        'name': row.get('Название_Спец'),
                        'faculty': faculty,
                        'department': department,
                        'qualification': row.get('Квалификация', '-'),
                        'specialty_type': row.get('Специальность', '-'),
                        'prefix': row.get('Префикс'),
                        'parent_code': row.get('КодРодителя')
                    }
                )

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin, CsvImport):
    list_display = ('external_id', 'short_name', 'name', 'faculty', 'head_name')
    list_filter = ('faculty',)
    change_list_template = "admin/department_change_list.html"

    def get_urls(self):
        return self.get_import_urls() + super().get_urls()

    def process_import_csv(self, data):
        with transaction.atomic():
            for row in data:
                faculty = Faculty.objects.filter(external_id=row.get('Код_Факультета')).first()
                Department.objects.update_or_create(
                    external_id=row.get('Код'),
                    defaults={
                        'name': row.get('Название'),
                        'short_name': row.get('Сокращение'),
                        'faculty': faculty,
                        'phone': row.get('Телефон', '-'),
                        'head_name': row.get('ЗавКафедрой', '-'),
                    }
                )

@admin.register(Group)
class GroupAdmin(admin.ModelAdmin, CsvImport):
    list_display = ('external_id', 'name', 'get_faculty', 'get_department', 'get_specialty', 'course', 'education_level_decode', 'education_form_decode', 'academic_year')
    list_filter = ('specialty__faculty', 'course', 'education_form')
    search_fields = ('external_id', 'name', 'specialty__name')
    change_list_template = "admin/group_change_list.html"

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
        return self.get_import_urls() + super().get_urls()

    def process_import_csv(self, data):
        with transaction.atomic():
            for row in data:
                # Нет нужных специальностей, поэтому групп некоторых нет
                specialty = Specialty.objects.filter(external_id=row.get('Код_специальности')).first()
                if specialty == None:
                    continue

                Group.objects.update_or_create(
                    external_id=row.get('Код'),
                    defaults={
                        'name': row.get('Название'),
                        'specialty': specialty,
                        'course': row.get('Курс', 1),
                        'academic_year': row.get('Учебныйгод', '-'),
                        'education_duration': row.get('СрокОбучения'),
                        'education_level': row.get('Уровень', '-'),
                        'education_level_decode': row.get('Название_Уровня', ''),
                        'education_form': row.get('Форма_Обучения', '-'),
                        'education_form_decode': row.get('Название_Формы_Обучения', '')
                    }
                )