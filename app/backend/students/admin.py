from django.contrib import admin
from django.db import transaction
from django.contrib.auth.models import Group as DjangoGroup
from django.contrib import messages

from core.admin_password_generator import generate_password
from core.admin_save_generated_password_for_user import log_generated_passwords
from core.admin_import_csv import CsvImport
from core.admin_import_json import JsonImport
from university_structure.models import Faculty, Department, Group, Staff
from users.models import User

from .models import Student, Document, Category, AchievementType, ScoringRule, Level, AchievementResult, DocType, DocumentStatus, DocumentFile

import logging


logger = logging.getLogger(__name__)

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin, CsvImport):
    list_display = ('full_name', 'record_book', 'group', 'status', 'total_score')
    list_filter = ('group__specialty__faculty', 'group__course', 'status')
    search_fields = ('full_name', 'record_book', 'email')
    readonly_fields = ('created_at',)
    change_list_template = "admin/student_change_list.html"

    def get_urls(self):
        urls = super().get_urls()
        return self.get_import_urls() + urls

    def process_import_csv(self, request, data):
        new_credentials = []
        total_rows = len(data)
        logger.info(f"Начало обработки: {total_rows} строк.")

        with transaction.atomic():
            g_student, _ = DjangoGroup.objects.get_or_create(name='Student')

            # select_related тянет сразу и специальность, и кафедру за 1 запрос
            groups_map = {
                g.external_id: g 
                for g in Group.objects.select_related('specialty__department').all()
            }
            # кешируем все факультеты
            faculties_map = {
                f.external_id: f 
                for f in Faculty.objects.all()
            }
            
            # кешируем существующих студентов по external_id
            existing_students = {
                s.external_id: s 
                for s in Student.objects.select_related('user').all()
            }
            
            for index, row in enumerate(data, 1):
                def clean_val(key):
                    val = str(row.get(key, '')).strip()
                    return '' if val.upper() == 'NULL' else val

                status_raw = clean_val('Статус')
                if status_raw not in ['1', '-1']:
                    continue
                
                status = int(status_raw)

                external_id = clean_val('Код')
                record_book = clean_val('Номер_Зачетной_Книжки')
                email = clean_val('E_Mail')
                last_name = clean_val('Фамилия')
                first_name = clean_val('Имя')
                patronymic = clean_val('Отчество')
                status_decoding = clean_val('Расшифровка_Статуса')

                group_code = clean_val('Код_Группы')
                group = groups_map.get(group_code)
                
                faculty_code = clean_val('КодФакультета')
                faculty = faculties_map.get(faculty_code)
                
                # Кафедра подтянется без запроса к БД, так как мы использовали select_related выше
                department = group.specialty.department if group and hasattr(group, 'specialty') else None

                is_monitor = clean_val('Староста') == '1'
                admission_year_raw = clean_val('Год_Поступления')
                admission_year = int(admission_year_raw) if admission_year_raw.isdigit() else None

                student = existing_students.get(external_id)

                if student:
                    # Если студент есть, работаем с его существующим юзером
                    user = student.user
                    # Обновляем данные юзера
                    user.first_name = first_name
                    user.last_name = last_name
                    user.patronymic = patronymic
                    user.email = email
                    user.save()
                else:
                    # Если студента нет, создаем/обновляем юзера по username
                    username = email if email else f"student_{external_id}@bgitu.ru"
                    password = generate_password()
                    user = User.objects.create_user(
                        username=username,
                        email=email,
                        password=password,
                        first_name=first_name,
                        last_name=last_name,
                        patronymic=patronymic,
                    )
                    user.save() 
                    user.groups.add(g_student)
                    # Это для списка логирования ФИО, группы, логина и пароля,
                    new_credentials.append({
                        'group_code': group_code,
                        'group': group,
                        'admission_year': admission_year,
                        'full_name': f"{last_name} {first_name} {patronymic}".strip(),
                        'login': username,
                        'password': password
                    })

                # 2. Теперь сохраняем студента через update_or_create
                Student.objects.update_or_create(
                    external_id=external_id,
                    defaults={
                        "user": user,
                        "full_name": user.get_full_username(),
                        "group": group,
                        "department": department,
                        "email": email,
                        "faculty": faculty,
                        "record_book": record_book,
                        "status": str(status),
                        "status_decoding": status_decoding,
                        "admission_year": admission_year,
                        "is_monitor": is_monitor,
                    }
                )

                if index % 50 == 0 or index == total_rows:
                    percent = (index / total_rows) * 100
                    print(f">>> Обработано: {index}/{total_rows} ({percent:.1f}%)")
                    logger.info(f"Progress: {index}/{total_rows}")
        
        print("Обработка завершена успешно.\n")
        if new_credentials:
            filename, _ = log_generated_passwords(new_credentials, prefix="students")
            self.message_user(
                request,
                f"Файл с паролями: config-files/import_passwords/{filename}",
                messages.SUCCESS
            )
        else:
            self.message_user(request, "Данные обновлены. Новых пользователей не создано.", messages.SUCCESS)

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
class CategoryAdmin(admin.ModelAdmin, JsonImport):
    list_display = ('code', 'label')

    change_list_template = "admin/achievement_change_list.html"
    
    def get_urls(self):
        return self.get_import_urls() + super().get_urls()
 
    def process_import_json(self, data):
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
    """
    Инлайн-панель для отображения и редактирования файлов, 
    прикрепленных к конкретному документу достижения.
    """
    model = DocumentFile
    extra = 0  # Чтобы не отображались лишние пустые строки
    fields = ('original_file_name', 'file', 'order', 'uploaded_at')
    readonly_fields = ('uploaded_at',)

@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = (
        'user__student_profile__record_book', 'user__student_profile__group__specialty__faculty', 'achievement', 
        'category', 'sub_type', 'level', 'result', 'score', 
        'status', 'date_received'
    )
    inlines = [DocumentFileInline] 
    
    list_filter = ('status', 'category', 'date_received')
    search_fields = ('student__full_name', 'student__record_book', 'achievement')
