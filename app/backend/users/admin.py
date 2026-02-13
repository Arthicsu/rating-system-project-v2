from django import forms
from django.contrib import admin, messages
from django.db import transaction
from django.contrib.auth.admin import UserAdmin
from university_structure.models import Faculty, Group, Teacher
from students.models import Student
from .models import User
import json
from django.urls import path
from django.shortcuts import render, redirect

class JsonImportForm(forms.Form):
    json_file = forms.FileField(label="Выберите json-файл")

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'first_name', 'last_name', 'is_teacher', 'is_student', 'is_staff')
    
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
            for fac_data in data.get('faculties', []):
                Faculty.objects.get_or_create(
                    short_name=fac_data['short_name'],
                    defaults={'name': fac_data['name']}
                )

            for t_data in data.get('teachers', []):
                user, created = User.objects.get_or_create(
                    username=t_data['username'],
                    defaults={
                        "email": t_data.get('email', t_data['username']),
                        "first_name": t_data['first_name'],
                        "last_name": t_data['last_name'],
                        "patronymic": t_data.get('patronymic', ''),
                        "is_teacher": True
                    }
                )
                if created:
                    user.set_password(t_data.get('password', 'ZAQ123wsx'))
                    user.save()
                
                faculty = Faculty.objects.get(short_name=t_data['faculty_short_name'])
                Teacher.objects.get_or_create(
                    user=user,
                    defaults={
                        "faculty": faculty,
                        "phone": t_data.get('phone', ''),
                        "position": t_data.get('position', 'Преподаватель')
                    }
                )

            for gr_data in data.get('groups', []):
                curator = User.objects.get(username=gr_data['curator_username'])
                faculty = Faculty.objects.get(short_name=gr_data['faculty_short_name'])
                Group.objects.get_or_create(
                    name=gr_data['name'],
                    defaults={
                        "faculty": faculty,
                        "course": gr_data['course'],
                        "curator": curator
                    }
                )

            for s_data in data.get('students', []):
                user, created = User.objects.get_or_create(
                    username=s_data['username'],
                    defaults={
                        "email": s_data.get('email', s_data['username']),
                        "first_name": s_data['first_name'],
                        "last_name": s_data['last_name'],
                        "patronymic": s_data.get('patronymic', ''),
                        "is_student": True
                    }
                )
                if created:
                    user.set_password(s_data.get('password', 'ZAQ123wsx'))
                    user.save()

                group = Group.objects.get(name=s_data['group_name'])
                faculty = Faculty.objects.get(short_name=s_data['faculty_short_name'])
                
                Student.objects.get_or_create(
                    user=user,
                    defaults={
                        "full_name": f"{user.last_name} {user.first_name} {user.patronymic}".strip(),
                        "group": group,
                        "faculty": faculty,
                        "record_book": s_data['record_book'],
                        "phone": s_data.get('phone', ''),
                    }
                )

@admin.register(Faculty)
class FacultyAdmin(admin.ModelAdmin):
    list_display = ('short_name', 'name')
    search_fields = ('short_name', 'name')

@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'faculty', 'course', 'curator')
    list_filter = ('faculty', 'course')
    search_fields = ('name',)

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'group', 'academic_score', 'total_score')
    list_filter = ('group__faculty', 'group__course', 'group')
    search_fields = ('full_name', 'record_book')
    readonly_fields = ('created_at',)

@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ('get_full_name', 'faculty')
    list_filter = ('faculty',)
    search_fields = ('user__last_name', 'user__first_name')

    def get_full_name(self, obj):
        return obj.user.get_full_username()
    get_full_name.short_description = 'ФИО'