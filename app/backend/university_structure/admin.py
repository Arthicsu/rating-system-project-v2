from django import forms
from django.contrib import admin, messages
from django.db import transaction
from django.contrib.auth.models import Group as DjangoGroup
from django.urls import path
from django.shortcuts import render, redirect

from users.models import User
from .models import Faculty, Department, Group, Staff

import json


class JsonImportForm(forms.Form):
    json_file = forms.FileField(label="Файл структуры (JSON)")

@admin.register(Staff)
class StaffAdmin(admin.ModelAdmin):
    list_display = ('get_full_name', 'department', 'faculty')
    list_filter = ('faculty',)
    search_fields = ('user__last_name', 'user__first_name')

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
                Faculty.objects.get_or_create(
                    short_name=fac_data['short_name'],
                    defaults={'name': fac_data['name']}
                )
            
            # Кафедры
            for dep_data in data.get('departments', []):
                # Находим факультет для кафедры
                faculty = Faculty.objects.get(short_name=dep_data['faculty_short_name'])
                Department.objects.get_or_create(
                    short_name=dep_data['short_name'],
                    defaults={
                        'name': dep_data['name'],
                        'faculty': faculty,
                    }
                )

            # Группы
            for gr_data in data.get('groups', []):
                department = Department.objects.get(short_name=gr_data['department_short_name'])
                Group.objects.get_or_create(
                    name=gr_data['name'],
                    defaults={
                        "department": department,
                        "course": gr_data['course'],
                    }
                )

            g_dept, _ = DjangoGroup.objects.get_or_create(name='Department')
            g_dean, _ = DjangoGroup.objects.get_or_create(name='Dean')
            g_rector, _ = DjangoGroup.objects.get_or_create(name='Rectorate')

            # Сотрудники
            for staff_data in data.get('staffs', []):
                user, created = User.objects.get_or_create(
                    username=staff_data['username'],
                    defaults={
                        "email": staff_data.get('email', staff_data['username']),
                        "first_name": staff_data['first_name'],
                        "last_name": staff_data['last_name'],
                        "patronymic": staff_data.get('patronymic', ''),
                        "is_staff": True, 
                    }
                )
                if created:
                    user.set_password(staff_data.get('password', 'ZAQ123wsx'))
                    user.save()

                role_input = staff_data.get('role', '')
                if role_input == 'Декан':
                    user.groups.add(g_dean)
                elif role_input == 'Проректор':
                    user.groups.add(g_rector)
                else:
                    user.groups.add(g_dept)

                faculty = Faculty.objects.filter(short_name=staff_data.get('faculty_short_name')).first()
                department = Department.objects.filter(short_name=staff_data.get('department_short_name')).first()
                if department and not faculty:
                    faculty = department.faculty

                Staff.objects.get_or_create(
                    user=user,
                    defaults={"faculty": faculty, "department": department}
                )

    def get_full_name(self, obj):
        return obj.user.get_full_username()
    get_full_name.short_description = 'ФИО'

@admin.register(Faculty)
class FacultyAdmin(admin.ModelAdmin):
    list_display = ('short_name', 'name')
    search_fields = ('short_name', 'name')

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('short_name', 'name', 'faculty')
    list_filter = ('faculty',)

@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'get_faculty', 'get_department', 'course')
    list_filter = ('department__faculty', 'course')
    search_fields = ('name',)

    def get_faculty(self, obj):
        return obj.department.faculty if obj.department else "-"
    get_faculty.short_description = "Факультет"

    def get_department(self, obj):
        return obj.department if obj.department else "-"
    get_department.short_description = "Кафедра"