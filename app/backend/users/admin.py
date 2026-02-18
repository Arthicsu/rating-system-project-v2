from django import forms
from django.contrib import admin, messages
from django.db import transaction
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import Group as DjangoGroup
from django.urls import path
from django.shortcuts import render, redirect

from university_structure.models import Faculty, Department, Group, Staff
from students.models import Student
from .models import User

import json



class JsonImportForm(forms.Form):
    json_file = forms.FileField(label="Выберите json-файл")

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'first_name', 'last_name', 'is_staff')
    change_list_template = "admin/user_change_list.html"

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('import-json/', self.admin_site.admin_view(self.import_json), name='import-json'),
        ]
        return custom_urls + urls

    def import_json(self, request):
        if request.method == "POST":
            form = JsonImportForm(request.POST, request.FILES)
            if form.is_valid():
                json_file = request.FILES['json_file']
                try:
                    data = json.load(json_file)
                    self.process_import(data)
                    self.message_user(request, "Данные успешно импортированы", messages.SUCCESS)
                except Exception as e:
                    self.message_user(request, f"Ошибка импорта: {e}", messages.ERROR)
                return redirect("..")
        
        form = JsonImportForm()
        context = {
            **self.admin_site.each_context(request),
            'form': form,
            'title': "Импорт пользователей из JSON"
        }
        return render(request, "admin/json_import_form.html", context)

    def process_import(self, data):
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

            g_student, _ = DjangoGroup.objects.get_or_create(name='Student')
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

            # Студенты
            for stud_data in data.get('students', []):
                user, created = User.objects.get_or_create(
                    username=stud_data['username'],
                    defaults={
                        "email": stud_data.get('email', stud_data['username']),
                        "first_name": stud_data['first_name'],
                        "last_name": stud_data['last_name'],
                        "patronymic": stud_data.get('patronymic', ''),
                    }
                )
                if created:
                    user.set_password(stud_data.get('password', 'ZAQ123wsx'))
                    user.save()

                user.groups.add(g_student)

                group = Group.objects.get(name=stud_data['group_name'])
                Student.objects.get_or_create(
                    user=user,
                    defaults={
                        "full_name": user.get_full_username(),
                        "group": group,
                        "department": group.department,
                        "faculty": group.department.faculty if group.department else None,
                        "record_book": stud_data['record_book'],
                        "phone": stud_data.get('phone', '-'),
                    }
                )

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

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'group', 'academic_score', 'total_score')
    list_filter = ('group__department__faculty', 'group__course') 
    search_fields = ('full_name', 'record_book')
    readonly_fields = ('created_at',)

@admin.register(Staff)
class StaffAdmin(admin.ModelAdmin):
    list_display = ('get_full_name', 'department', 'faculty')
    list_filter = ('faculty',)
    search_fields = ('user__last_name', 'user__first_name')

    def get_full_name(self, obj):
        return obj.user.get_full_username()
    get_full_name.short_description = 'ФИО'