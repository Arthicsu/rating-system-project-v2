from django.contrib import admin
from django.db import transaction
from django.contrib.auth.models import Group as DjangoGroup
from django.contrib import messages

from core.admin_password_generator import generate_password
from core.admin_save_generated_password_for_user import log_generated_passwords
from core.admin_import_csv import CsvImport
from core.admin_import_json import JsonImport
from core.eos.admin_mixin import EosSyncActionsMixin
from core.eos.syncers import StudentSyncer
from university_structure.models import Faculty, Department, Group, Staff
from users.models import User

from .models import Student, Document, Category, AchievementType, ScoringRule, Level, AchievementResult, DocType, DocumentStatus, DocumentFile

import logging


logger = logging.getLogger(__name__)

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin, CsvImport, EosSyncActionsMixin):
    list_display = ('full_name', 'record_book', 'group', 'admission_year', 'status', 'total_score')
    list_filter = ('faculty', 'admission_year', 'group__course', 'status')
    search_fields = ('full_name', 'record_book', 'email')
    readonly_fields = ('created_at', 'total_score')
    raw_id_fields = ('user', 'group', 'faculty', 'department')
    actions = ['import_csv_action', 'sync_eos_students_action']
    change_list_template = "admin/csv_import.html"
    no_selection_actions = ("import_csv_action", "sync_eos_students_action")

    def get_urls(self):
        urls = super().get_urls()
        return self.get_import_urls() + urls

    @admin.action(description="Обновить студентов из ЭОС (пока 401)")
    def sync_eos_students_action(self, request, queryset):
        try:
            self._report(request, [StudentSyncer().run()])
        except Exception as e:
            self.message_user(request, f"Ошибка синхронизации студентов с ЭОС: {e}", messages.ERROR)

    def process_import_csv(self, request, data):
        new_credentials = []
        total_rows = len(data)
        logger.info(f"Начало обработки: {total_rows} строк.")

        with transaction.atomic():
            g_student, _ = DjangoGroup.objects.get_or_create(name='Student')

            groups_map = {
                g.external_id: g
                for g in Group.objects.all()
            }
            # кешируем факультеты и кафедры: берём по прямым кодам из csv
            faculties_map = {
                f.external_id: f
                for f in Faculty.objects.all()
            }
            departments_map = {
                d.external_id: d
                for d in Department.objects.all()
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

                if not group:
                    continue

                faculty_code = clean_val('КодФакультета')
                faculty = faculties_map.get(faculty_code)
                
                dept_code = clean_val('Код_Кафедры') or clean_val('КодКафедры')
                department = departments_map.get(dept_code) if dept_code else None

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
                    user.save(update_fields=['first_name', 'last_name', 'patronymic'])
                else:
                    # Если студента нет, создаем/обновляем юзера по username
                    username = email if email else f"student_{external_id}@bgitu.ru"
                    password = generate_password()
                    user = User.objects.create_user(
                        username=username,
                        password=password,
                        first_name=first_name,
                        last_name=last_name,
                        patronymic=patronymic,
                    )
                    user.groups.add(g_student)
                    # Это для списка логирования ФИО, группы, логина и пароля,
                    new_credentials.append({
                        'full_name': f"{last_name} {first_name} {patronymic}".strip(),
                        'email': email,
                        'group_code': group_code,
                        'group': group,
                        'admission_year': admission_year,
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
    change_list_template = "admin/json_import.html"
    
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

            def save_achievement_type(category_obj, type_code, type_label, target_data):
                # Ключи, которые не являются правилами начисления баллов
                service_keys = {'label', 'needs_level', 'needs_result'}

                # Сначала пытаемся взять флаги напрямую из JSON
                needs_level = target_data.get('needs_level')
                needs_result = target_data.get('needs_result')

                # Если флагов в JSON нет
                # if needs_level is None or needs_result is None:
                #     det_level, det_result = False, False
                #     for logic_key, logic_val in target_data.items():
                #         if logic_key in service_keys:
                #             continue
                #         if isinstance(logic_val, dict):
                #             det_level, det_result = True, True
                #         elif logic_key in known_results_data:
                #             det_result = True
                #         elif logic_key in known_levels_data:
                #             det_level = True
                    
                #     if needs_level is None: needs_level = det_level
                #     if needs_result is None: needs_result = det_result

                achieve_type, _ = AchievementType.objects.update_or_create(
                    category=category_obj,
                    code=type_code,
                    defaults={
                        'label': type_label,
                        'needs_level': needs_level,
                        'needs_result': needs_result
                    }
                )

                # Очищаем старые правила
                achieve_type.rules.all().delete()

                # Создаем правила начисления баллов
                for logic_key, logic_val in target_data.items():
                    if logic_key in service_keys:
                        continue  # Пропускаем служебные флаги

                    if logic_key == 'default':
                        ScoringRule.objects.create(
                            achievement_type=achieve_type, level=None, result=None, score=logic_val
                        )
                    elif isinstance(logic_val, dict):
                        # Структура: Уровень -> {Результат: Балл}
                        for res_key, score_val in logic_val.items():
                            ScoringRule.objects.create(
                                achievement_type=achieve_type,
                                level=db_levels.get(logic_key),
                                result=db_results.get(res_key),
                                score=score_val
                            )
                    else:
                        # Одиночные флаги (только результат или только уровень)
                        target_level = db_levels.get(logic_key) if logic_key in known_levels_data else None
                        target_result = db_results.get(logic_key) if logic_key in known_results_data else None

                        ScoringRule.objects.create(
                            achievement_type=achieve_type,
                            level=target_level,
                            result=target_result,
                            score=logic_val
                        )

            # Перебор категорий
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

                    # Проверяем на сгруппированность (в твоем текущем JSON групп нет, все типы плоские)
                    is_grouped = False
                    if isinstance(type_data, dict):
                        for k, v in type_data.items():
                            if k != 'label' and isinstance(v, dict) and k not in known_levels_data:
                                is_grouped = True
                                break

                    if is_grouped:
                        for sub_code, sub_data in type_data.items():
                            if sub_code == 'label' or not isinstance(sub_data, dict):
                                continue
                            sub_label = sub_data.get('label', sub_code)
                            save_achievement_type(category, sub_code, sub_label, sub_data)
                    else:
                        type_label = type_data.get('label', type_code) if isinstance(type_data, dict) else type_code
                        target_dict = type_data if isinstance(type_data, dict) else {}
                        save_achievement_type(category, type_code, type_label, target_dict)

class ScoringRuleInline(admin.TabularInline):
    model = ScoringRule
    extra = 0
    fields = ('achievement_type', 'level', 'result', 'score')

@admin.register(AchievementType)
class AchievementTypeAdmin(admin.ModelAdmin):
    list_display = ('label', 'category', 'code', 'needs_level', 'needs_result')
    list_filter = ('category',)
    raw_id_fields = ('category',)
    inlines = [ScoringRuleInline]

@admin.register(ScoringRule)
class ScoringRuleAdmin(admin.ModelAdmin):
    list_display = ('get_category', 'achievement_type__label', 'level', 'result', 'score')
    list_filter = ('achievement_type__category', 'level', 'result')
    search_fields = ('achievement_type__label', 'achievement_type__code')
    raw_id_fields = ('achievement_type', 'level', 'result')

    # Метод для вывода категории (так как она связана через achievement_type)
    @admin.display(description='Категория', ordering='achievement_type__category')
    def get_category(self, obj):
        try:
            return obj.achievement_type.category.label
        except Exception:
            return '-'
            
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
    list_display = ('get_student', 'get_group', 'get_faculty', 'achievement', 'category', 'score', 'status', 'date_received')
    list_filter = ('status', 'category', 'sub_type', 'date_received')
    search_fields = ('user__student_profile__full_name', 'user__student_profile__record_book', 'achievement')
    raw_id_fields = ('user', 'verified_by', 'category', 'sub_type', 'level', 'result', 'doc_type', 'status')
    inlines = [DocumentFileInline]

    @admin.display(description='Студент')
    def get_student(self, obj):
        try:
            return obj.user.student_profile.full_name
        except Exception:
            return '-'

    @admin.display(description='Группа')
    def get_group(self, obj):
        try:
            return obj.user.student_profile.group
        except Exception:
            return '-'

    @admin.display(description='Факультет')
    def get_faculty(self, obj):
        try:
            return obj.user.student_profile.faculty
        except Exception:
            return '-'
