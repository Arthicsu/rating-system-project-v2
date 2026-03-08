from django import forms
from django.contrib import admin, messages
from django.db import transaction
from django.contrib.auth.models import Group as DjangoGroup
from django.urls import path
from django.shortcuts import render, redirect

from users.models import User
from .models import Faculty, Department, Group, Staff, Specialty

import json


class JsonImportForm(forms.Form):
    json_file = forms.FileField(label="Файл структуры (JSON)")

@admin.register(Staff)
class StaffAdmin(admin.ModelAdmin):
    list_display = ('get_roles', 'department', 'faculty')
    list_filter = ('faculty', 'department', 'user__groups')
    search_fields = ('department__name', 'faculty__name')

    def get_roles(self, obj):
        return ", ".join([group.name for group in obj.user.groups.all()])
    get_roles.short_description = 'Роли (Группы)'

    change_list_template = "admin/staffadmin_change_list.html"
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('import-structure/', self.admin_site.admin_view(self.import_json), name='import-structure-json'),
        ]
        return custom_urls + urls

        
    def import_json(self, request):
        if request.method == "POST":
            form = JsonImportForm(request.POST, request.FILES)
            if form.is_valid():
                json_file = request.FILES['json_file']
                try:
                    data = json.load(json_file)
                    self.process_import_structure_json(data)
                    self.message_user(request, "Структура успешно обновлена", messages.SUCCESS)
                except Exception as e:
                    self.message_user(request, f"Ошибка JSON: {e}", messages.ERROR)
                return redirect("..")
        form = JsonImportForm()
        context = {
            **self.admin_site.each_context(request),
            'form': form,
            'title': "Импорт структуры из JSON"
        }
        return render(request, "admin/import_form.html", context)
        
    def process_import_structure_json(self, data):
        with transaction.atomic():
            # Факультеты
            for fac_data in data.get('faculties', []):
                Faculty.objects.update_or_create(
                    external_id=fac_data['external_id'],
                    defaults={
                        'name': fac_data['name'],
                        'short_name': fac_data['short_name'],
                        'alias': fac_data['alias'],
                        'dean_name': fac_data['short_name'],
                        'phone': fac_data.get('phone', '-'),
                        'email': fac_data.get('phone', '-'),
                        'subdivision_type': fac_data.get('subdivision_type', '-')
                    }
                )
            
            # Кафедры
            for dep_data in data.get('departments', []):
                Department.objects.update_or_create(
                    external_id=dep_data['external_id'],
                    defaults={
                        'name': dep_data['name'],
                        'short_name': dep_data['short_name'],
                        'faculty': Faculty.objects.filter(external_id=dep_data['faculty_id']).first(),
                        'head_name': dep_data.get('head_name', '-'),
                    }
                )

            # Специальности
            for s_data in data.get('specialties', []):
                Specialty.objects.update_or_create(
                    external_id=s_data['external_id'],
                    defaults={
                        'code_fgos': s_data['code_fgos'], 
                        'name': s_data['name'],
                        'faculty': Faculty.objects.filter(external_id=s_data['faculty_id']).first(),
                        'department': Department.objects.filter(external_id=s_data['department_id']).first(),
                        'qualification': s_data.get('qualification', '-'),
                        'specialty_type': s_data.get('specialty_type', '-'),
                        'prefix': s_data.get('prefix'),
                        'parent_code': s_data.get('parent_code')
                    }
                )

            # Группы
            for gr_data in data.get('groups', []):
                Group.objects.update_or_create(
                    external_id=gr_data['external_id'],
                    defaults={
                        "name": gr_data['name'],
                        "specialty": Specialty.objects.filter(external_id=gr_data.get('specialty_id')).first(),
                        "course": gr_data['course'],
                        "academic_year": gr_data['academic_year'],
                        "education_duration": gr_data.get('education_duration'),
                        "education_level": gr_data['education_level'],
                        "education_form": gr_data['education_form'],
                    }
                )

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
class FacultyAdmin(admin.ModelAdmin):
    list_display = ('short_name', 'name', 'alias', 'dean_name', 'phone')
    search_fields = ('short_name', 'name')

@admin.register(Specialty)
class SpecialtyAdmin(admin.ModelAdmin):
    list_display = ('code_fgos', 'name', 'faculty', 'department')
    list_filter = ('faculty', 'department')
    search_fields = ('code_fgos', 'name')

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('short_name', 'name', 'faculty', 'head_name')
    list_filter = ('faculty',)

@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'get_faculty', 'get_department', 'get_specialty', 'course', 'education_level')
    list_filter = ('specialty__faculty', 'course', 'education_form')
    search_fields = ('name', 'specialty__name')

    def get_faculty(self, obj):
        return obj.specialty.faculty if obj.specialty else "-"
    get_faculty.short_description = "Факультет"

    def get_specialty(self, obj):
        return obj.specialty if obj.specialty else "-"
    get_specialty.short_description = "Специальность"

    def get_department(self, obj):
        return obj.specialty.department if obj.specialty else "-"
    get_department.short_description = "Кафедра"