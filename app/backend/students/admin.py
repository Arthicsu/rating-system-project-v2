from django import forms
from django.contrib import admin, messages
from django.db import transaction
from django.contrib.auth.models import Group as DjangoGroup
from django.urls import path
from django.shortcuts import render, redirect

from university_structure.models import Faculty, Department, Group, Staff
from users.models import User
from .models import Student

import csv


class CsvImportForm(forms.Form):
    csv_file = forms.FileField(label="Список студентов (CSV)")

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'group', 'academic_score', 'total_score')
    list_filter = ('group__department__faculty', 'group__course') 
    search_fields = ('full_name', 'record_book')
    readonly_fields = ('created_at',)
    change_list_template = "admin/student_change_list.html"

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('import-students/', self.admin_site.admin_view(self.import_csv), name='import-students-csv'),
        ]
        return custom_urls + urls

    def import_csv(self, request):
        if request.method == "POST":
            form = CsvImportForm(request.POST, request.FILES)
            if form.is_valid():
                csv_file = request.FILES['csv_file'].read().decode('utf-8').splitlines()
                try:
                    data = csv.DictReader(csv_file)
                    self.process_import_students_csv(data)
                    self.message_user(request, "Студенты добавлены", messages.SUCCESS)
                except Exception as e:
                    self.message_user(request, f"Ошибка: {e}", messages.ERROR)
                return redirect("..")
        
        context = {
            **self.admin_site.each_context(request),
            'form': CsvImportForm(),
            'title': "Импорт студентов"
        }
        return render(request, "admin/import_form.html", context)

    def process_import_students_csv(self, data):
        with transaction.atomic():
            g_student, _ = DjangoGroup.objects.get_or_create(name='Student')

            # Студенты
            for row in data:
                user, created = User.objects.get_or_create(
                    username=row['username'],
                    defaults={
                        "email": row.get('email') or row['username'],
                        "first_name": row['first_name'],
                        "last_name": row['last_name'],
                        "patronymic": row.get('patronymic', ''),
                    }
                )
                if created:
                    user.set_password(row.get('password', 'ZAQ123wsx'))
                    user.save()

                user.groups.add(g_student)
                try:
                    group = Group.objects.get(name=row['group_name'])
                except Group.DoesNotExist:
                    continue
                Student.objects.get_or_create(
                    user=user,
                    defaults={
                        "full_name": user.get_full_username(),
                        "group": group,
                        "department": group.department,
                        "faculty": group.department.faculty if group.department else None,
                        "record_book": row['record_book'],
                        "phone": row.get('phone', '-'),
                    }
                )
