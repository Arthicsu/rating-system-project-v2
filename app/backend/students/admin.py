from django import forms
from django.contrib import admin, messages
from django.db import transaction
from django.contrib.auth.models import Group as DjangoGroup
from django.urls import path
from django.shortcuts import render, redirect

from university_structure.models import Faculty, Department, Group, Staff
from users.models import User
from .models import Student, Document, Category, AchievementType, ScoringRule, Level, AchievementResult, DocType, DocumentStatus, DocumentFile
import csv, json

class JsonImportForm(forms.Form):
    json_file = forms.FileField(label="Файл конфигурации достижений (JSON)")

class CsvImportForm(forms.Form):
    csv_file = forms.FileField(label="Список студентов (CSV)")

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'record_book', 'group', 'status', 'total_score')
    list_filter = ('group__specialty__faculty', 'group__course', 'status')
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
                user, created = User.objects.update_or_create(
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
                    group = Group.objects.get(external_id=row['group_id'])
                except Group.DoesNotExist:
                    continue

                monitor_raw = str(row.get('is_monitor', '')).lower().strip()
                is_monitor_bool = monitor_raw == 'true'
                Student.objects.update_or_create(
                    external_id=row['student_id'],
                    user=user,
                    defaults={
                        "full_name": user.get_full_username(),
                        "group": group,
                        "department": group.specialty.department,
                        "faculty": group.specialty.faculty,
                        "record_book": row['record_book'],
                        "phone": row.get('phone', '-'),
                        "status": row.get('status', '6'),
                        "admission_year": row.get('admission_year', '-'),
                        "is_monitor": is_monitor_bool,
                    }
                )

@admin.register(Level)
class LevelAdmin(admin.ModelAdmin):
    list_display = ('label', 'code')

@admin.register(AchievementResult)
class AchievementResultAdmin(admin.ModelAdmin):
    list_display = ('label', 'code')

@admin.register(DocType)
class DocTypeAdmin(admin.ModelAdmin):
    list_display = ('label', 'code')

@admin.register(DocumentStatus)
class DocumentStatusAdmin(admin.ModelAdmin):
    list_display = ('label', 'code')

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('code', 'label')

    change_list_template = "admin/achievement_change_list.html"
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('import-achievement-config/', self.admin_site.admin_view(self.import_json), name='import-achievement-config'),
        ]
        return custom_urls + urls

        
    def import_json(self, request):
        if request.method == "POST":
            form = JsonImportForm(request.POST, request.FILES)
            if form.is_valid():
                json_file = request.FILES['json_file']
                try:
                    data = json.load(json_file)
                    self.process_import_achievement_json(data)
                    self.message_user(request, "Конфигурация достижений успешно обновлена", messages.SUCCESS)
                except Exception as e:
                    self.message_user(request, f"Ошибка JSON: {e}", messages.ERROR)
                return redirect("..")
        form = JsonImportForm()
        context = {
            **self.admin_site.each_context(request),
            'form': form,
            'title': "Импорт конфигурации достижений из JSON"
        }
        return render(request, "admin/import_form.html", context)
        
    def process_import_achievement_json(self, data):
        metadata = data.get('metadata', {})
        known_levels_data = metadata.get('levels', {})
        known_results_data = metadata.get('results', {})
        known_doc_types = metadata.get('doc_types', {})
        known_statuses = metadata.get('statuses', {})

        with transaction.atomic():
            db_levels = {}
            for code, label in known_levels_data.items():
                obj, _ = Level.objects.update_or_create(code=code, defaults={'label': label})
                db_levels[code] = obj

            db_results = {}
            for code, label in known_results_data.items():
                obj, _ = AchievementResult.objects.update_or_create(code=code, defaults={'label': label})
                db_results[code] = obj
                
            for code, label in known_doc_types.items():
                DocType.objects.update_or_create(code=code, defaults={'label': label})
                
            for code, label in known_statuses.items():
                DocumentStatus.objects.update_or_create(code=code, defaults={'label': label})

            # Категории и достижения
            for cat_code, cat_data in data.items():
                if cat_code == 'metadata':
                    continue

                category, _ = Category.objects.update_or_create(
                    code=cat_code,
                    defaults={'label': cat_data.get('label', cat_code)}
                )

                for type_code, type_data in cat_data.items():
                    if type_code == 'label':
                        continue

                    type_label = type_data.get('label', type_code)
                    needs_level = False
                    needs_result = False

                    # Анализируем, нужны ли уровни/результаты
                    for logic_key, logic_val in type_data.items():
                        if logic_key == 'label':
                            continue
                        if isinstance(logic_val, dict):
                            needs_level = True
                            needs_result = True
                        elif logic_key in known_results_data:
                            needs_result = True
                        elif logic_key in known_levels_data:
                            needs_level = True

                    achieve_type, _ = AchievementType.objects.update_or_create(
                        category=category,
                        code=type_code,
                        defaults={
                            'label': type_label,
                            'needs_level': needs_level,
                            'needs_result': needs_result
                        }
                    )

                    # Очищаем старые правила
                    achieve_type.rules.all().delete()

                    # Создаем правила начисления баллов, связывая их с объектами метаданных
                    for logic_key, logic_val in type_data.items():
                        if logic_key == 'label':
                            continue

                        if logic_key == 'default':
                            ScoringRule.objects.create(
                                achievement_type=achieve_type,
                                level=None,
                                result=None,
                                score=logic_val
                            )

                        elif isinstance(logic_val, dict):
                            for res_key, score_val in logic_val.items():
                                ScoringRule.objects.create(
                                    achievement_type=achieve_type,
                                    level=db_levels.get(logic_key),
                                    result=db_results.get(res_key),
                                    score=score_val
                                )

                        else:
                            target_level = db_levels.get(logic_key) if logic_key in known_levels_data else None
                            target_result = db_results.get(logic_key) if logic_key in known_results_data else None

                            ScoringRule.objects.create(
                                achievement_type=achieve_type,
                                level=target_level,
                                result=target_result,
                                score=logic_val
                            )

class ScoringRuleInline(admin.TabularInline):
    model = ScoringRule
    extra = 0
    fields = ('achievement_type', 'level', 'result', 'score')

@admin.register(AchievementType)
class AchievementTypeAdmin(admin.ModelAdmin):
    list_display = ('label', 'category', 'code', 'needs_level', 'needs_result')
    list_filter = ('category',)
    inlines = [ScoringRuleInline]

@admin.register(ScoringRule)
class ScoringRuleAdmin(admin.ModelAdmin):
    list_display = ('get_category', 'achievement_type', 'level', 'result', 'score')
    list_filter = ('achievement_type__category', 'level', 'result')
    search_fields = ('achievement_type__label', 'achievement_type__code')

    # Метод для вывода категории (так как она связана через achievement_type)
    @admin.display(description='Категория', ordering='achievement_type__category')
    def get_category(self, obj):
        return obj.achievement_type.category.label

class DocumentFileInline(admin.TabularInline):
    model = DocumentFile
    extra = 0
    readonly_fields = ('original_file_name', 'file_url', 'uploaded_at', 'order')

@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('student__record_book', 'student__group__specialty__faculty', 'achievement', 
    'category', 'sub_type', 'level', 'result', 'score', 
    'status', 'date_received')
    list_filter = ('category', 'status', 'doc_type')
    search_fields = ('student__record_book', 'category')
    inlines = [DocumentFileInline]