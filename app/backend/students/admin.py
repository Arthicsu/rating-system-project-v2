from django import forms
from django.contrib import admin
from django.db import transaction
from django.contrib.auth.models import Group as DjangoGroup
from django.contrib import messages
from django.utils import timezone

from core.admin_password_generator import generate_password
from core.admin_save_generated_password_for_user import log_generated_passwords
from core.admin_import_csv import CsvImport, CsvImportForm
from core.admin_import_json import JsonImport
from core.eos.admin_mixin import EosSyncActionsMixin
from core.eos.syncers import StudentSyncer
from university_structure.models import Faculty, Department, Group, Staff
from users.models import User

from .models import Student, Document, Category, AchievementType, ScoringRule, Level, AchievementResult, DocType, DocumentStatus, DocumentFile, SemesterScore

import logging


logger = logging.getLogger(__name__)


class StudentCsvImportForm(CsvImportForm):
    """Форма импорта студентов с опцией архивации отсутствующих в выгрузке."""
    archive_absent = forms.BooleanField(
        required=False,
        initial=False,
        label="Архивировать студентов, отсутствующих в файле",
        help_text="Отмечайте ТОЛЬКО при загрузке полной выгрузки. Студенты из групп, "
                  "присутствующих в файле, но без своей строки, будут переведены в архив. "
                  "Студентов из других групп это не затронет.",
    )


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin, CsvImport, EosSyncActionsMixin):
    list_display = ('full_name', 'record_book', 'group', 'admission_year', 'status', 'is_archived', 'total_score')
    list_filter = ('group__specialty__faculty', 'admission_year', 'group__course', 'status', ('archived_at', admin.EmptyFieldListFilter))
    search_fields = ('full_name', 'record_book', 'email')
    readonly_fields = ('created_at', 'total_score', 'archived_at')
    raw_id_fields = ('user', 'group', 'faculty', 'department')
    actions = ['action_archive', 'action_unarchive']
    change_list_template = "admin/import_actions.html"
    csv_import_form_class = StudentCsvImportForm
    eos_syncer_class = StudentSyncer
    eos_sync_label = "Обновить студентов из ЭОС (не работает)"

    def get_urls(self):
        urls = super().get_urls()
        return self.get_import_urls() + self.get_eos_urls() + urls

    @admin.display(boolean=True, description='В архиве', ordering='archived_at')
    def is_archived(self, obj):
        return obj.archived_at is not None

    @admin.action(description="Архивировать выбранных студентов")
    def action_archive(self, request, queryset):
        updated = queryset.filter(archived_at__isnull=True).update(archived_at=timezone.now())
        self.message_user(request, f"Архивировано студентов: {updated}.", messages.SUCCESS)

    @admin.action(description="Вернуть из архива выбранных студентов")
    def action_unarchive(self, request, queryset):
        updated = queryset.filter(archived_at__isnull=False).update(archived_at=None)
        self.message_user(request, f"Возвращено из архива: {updated}.", messages.SUCCESS)

    def process_import_csv(self, request, data):
        new_credentials = []
        skipped_no_group = []
        archived_terminal = 0          # переведено в архив по статусу 3/4/6
        active_processed = 0           # создано/обновлено активных студентов
        seen_external_ids = set()      # все коды студентов, встреченные в файле
        seen_group_ids = set()         # id групп, реально присутствующих в файле
        total_rows = len(data)
        # Архивация отсутствующих — только при загрузке ПОЛНОЙ выгрузки (галочка в форме).
        archive_absent = request.POST.get('archive_absent') in ('on', 'true', 'True', '1')
        now = timezone.now()
        logger.info(f"Начало обработки: {total_rows} строк. archive_absent={archive_absent}")

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

                external_id = clean_val('Код')
                if not external_id:
                    continue
                seen_external_ids.add(external_id)

                status_raw = clean_val('Статус')
                # Расшифровка: из файла, иначе — по справочнику кодов.
                status_decoding = clean_val('Расшифровка_Статуса') or Student.STATUS_DECODINGS.get(status_raw, '')

                record_book = clean_val('Номер_Зачетной_Книжки')
                email = clean_val('E_Mail')
                last_name = clean_val('Фамилия')
                first_name = clean_val('Имя')
                patronymic = clean_val('Отчество')

                student = existing_students.get(external_id)

                # --- Терминальные статусы (отчислен/окончил/архив) -> в архив ---
                if status_raw in Student.TERMINAL_STATUSES:
                    if student is None:
                        # Студента нет в БД и он уже терминальный — заводить нет смысла.
                        continue
                    if student.archived_at is None:
                        # soft-delete: пользователь, история баллов и файлы не трогаются.
                        student.status = status_raw
                        student.status_decoding = status_decoding
                        student.archived_at = now
                        student.save(update_fields=['status', 'status_decoding', 'archived_at'])
                        archived_terminal += 1
                    elif student.status != status_raw or student.status_decoding != status_decoding:
                        # Уже в архиве — просто держим код/расшифровку статуса актуальными.
                        student.status = status_raw
                        student.status_decoding = status_decoding
                        student.save(update_fields=['status', 'status_decoding'])
                    continue

                # --- Активные статусы: только 1 (учащийся) и -1 (академ. отпуск) ---
                if status_raw not in Student.ACTIVE_STATUSES:
                    # Неизвестный код статуса — не трогаем запись.
                    logger.warning(f"Импорт: студент {external_id} — неизвестный статус '{status_raw}', строка пропущена.")
                    continue

                group_code = clean_val('Код_Группы')
                group = groups_map.get(group_code)

                if not group:
                    # Группа ещё не заведена в БД (например, ИВТ-401 нового учебного года
                    # не синхронизирована). Не создаём/не трогаем студента, но фиксируем пропуск,
                    # чтобы работник увидел, что нужно сначала синхронизировать структуру.
                    full_name = f"{last_name} {first_name} {patronymic}".strip()
                    skipped_no_group.append({
                        'external_id': external_id,
                        'group_code': group_code,
                        'full_name': full_name,
                    })
                    logger.warning(
                        f"Импорт: студент {external_id} ({full_name}) пропущен - группа с кодом '{group_code}' не найдена в БД. Сначала синхронизируйте структуру (факультеты/кафедры/группы)."
                    )
                    continue

                # Группа реально присутствует в файле — попадает в scope архивации отсутствующих.
                seen_group_ids.add(group.id)

                faculty_code = clean_val('КодФакультета')
                faculty = faculties_map.get(faculty_code)

                # Кафедра подтянется без запроса к БД, так как мы использовали select_related выше
                department = group.specialty.department if group and group.specialty else None

                is_monitor = clean_val('Староста') == '1'
                admission_year_raw = clean_val('Год_Поступления')
                admission_year = int(admission_year_raw) if admission_year_raw.isdigit() else None
                # TODO нужно обновлять всё у студента
                if student:
                    # Если студент есть, работаем с его существующим юзером
                    user = student.user
                    # Обновляем данные юзера
                    user.first_name = first_name
                    user.last_name = last_name
                    user.patronymic = patronymic
                    user.email = email
                    user.save(update_fields=['first_name', 'last_name', 'patronymic', 'email'])
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
                    user.groups.add(g_student)
                    new_credentials.append({
                        'full_name': f"{last_name} {first_name} {patronymic}".strip(),
                        'email': email,
                        'faculty': faculty.short_name if faculty else '-',
                        'department': department.short_name if department else '-',
                        'course': group.course,
                        'group': group.name,
                        'group_code': group_code,
                        'record_book': record_book or '-',
                        'admission_year': admission_year,
                        'login': username,
                        'password': password
                    })

                # сохраняем студента через update_or_create.
                # archived_at=None: активный статус разархивирует вернувшегося (академ/восстановление).
                defaults = {
                    "user": user,
                    "full_name": user.get_full_username(),
                    "group": group,
                    "email": email,
                    "record_book": record_book,
                    "status": status_raw,
                    "status_decoding": status_decoding,
                    "admission_year": admission_year,
                    "is_monitor": is_monitor,
                    "archived_at": None,
                }
                if faculty is not None:
                    defaults["faculty"] = faculty
                elif faculty_code:
                    logger.warning(
                        f"Импорт: студент {external_id} — факультет с кодом '{faculty_code}' не найден в БД, прежняя привязка к факультету сохранена."
                    )
                if department is not None:
                    defaults["department"] = department

                Student.objects.update_or_create(
                    external_id=external_id,
                    defaults=defaults,
                )
                active_processed += 1

                if index % 50 == 0 or index == total_rows:
                    percent = (index / total_rows) * 100
                    logger.info("Импорт студентов: обработано %s/%s (%.1f%%)", index, total_rows, percent)

            # --- Архивация отсутствующих в файле (только полная выгрузка) ---
            # Ограничиваемся группами, реально присутствующими в файле, чтобы частичная
            # выгрузка (например, один факультет) не заархивировала всех остальных.
            archived_absent = 0
            if archive_absent and seen_group_ids:
                archived_absent = (
                    Student.objects
                    .filter(group_id__in=seen_group_ids, archived_at__isnull=True)
                    .exclude(external_id__in=seen_external_ids)
                    .update(
                        archived_at=now,
                        status='6',
                        status_decoding=Student.STATUS_DECODINGS['6'],
                    )
                )

        logger.info("Импорт студентов завершён: обработано активных %s", active_processed)
        if skipped_no_group:
            logger.warning(
                f"Импорт: пропущено студентов из-за отсутствующих в БД групп: {len(skipped_no_group)}."
            )
            self.message_user(
                request,
                f"Пропущено {len(skipped_no_group)} строк(и): группа не найдена в БД. Синхронизируйте структуру (факультеты/кафедры/группы) и повторите импорт. Подробности - в логах бэкенда.",
                messages.WARNING,
            )
        if archived_terminal:
            self.message_user(
                request,
                f"Переведено в архив по статусу (отчислен/окончил/архив): {archived_terminal}.",
                messages.WARNING,
            )
        if archive_absent:
            self.message_user(
                request,
                f"Переведено в архив как отсутствующие в выгрузке: {archived_absent} "
                f"(в рамках {len(seen_group_ids)} групп из файла).",
                messages.WARNING,
            )
        if new_credentials:
            filename, _ = log_generated_passwords(new_credentials, prefix="students")
            self.message_user(
                request,
                f"Файл с паролями для новых студентов: {filename} (в shared/import_passwords).",
                messages.SUCCESS
            )
        else:
            self.message_user(request, "Данные обновлены. Новых пользователей не создано.", messages.SUCCESS)

        return active_processed

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
    list_display = ('get_student', 'get_group', 'get_faculty', 'achievement', 'category', 'score', 'status', 'semester', 'date_received')
    list_filter = ('status', 'category', 'sub_type', 'semester', 'date_received')
    search_fields = ('user__student_profile__full_name', 'user__student_profile__record_book', 'achievement')
    raw_id_fields = ('user', 'verified_by', 'category', 'sub_type', 'level', 'result', 'doc_type', 'status', 'semester')
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
            return obj.user.student_profile.group.specialty.faculty
        except Exception:
            return '-'


@admin.register(SemesterScore)
class SemesterScoreAdmin(admin.ModelAdmin):
    """История баллов по семестрам. Только для просмотра — правится через модерацию/ролловер."""
    list_display = ('student', 'semester', 'academic_score', 'research_score', 'sport_score', 'social_score', 'cultural_score', 'total_score')
    list_filter = ('semester',)
    search_fields = ('student__full_name', 'student__record_book')
    raw_id_fields = ('student', 'semester')
    readonly_fields = ('total_score',)
