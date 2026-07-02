from django.db.models import Prefetch, Avg, Count, Max, Min, Sum, Q
from django.utils import timezone
from datetime import datetime, time

from students.models import Student, Category, Document, SemesterScore
from university_structure.models import AcademicYear
from students.serializers import StudentProfileSerializer


class StudentFilterMixin:
    """
    Парсинг параметров и фильтрация по факультету, курсу или группе.
    """
    
    def get_student_radar_data(self, student):
        """Динамическое формирование данных радара из конфига"""
        categories = Category.objects.all()
        labels = []
        values = []
        
        for category in categories:
            labels.append(category.label)
            values.append(getattr(student, f"{category.code}_score", 0))
            
        return {"labels": labels, "data": values}

    def get_student_full_profile(self, student, is_own_profile=False):
        """
        Возвращает данные профиля студента для отображения в интерфейсе.
        Формирует сериализованные данные профиля, а также добавляет структуру данных для отображения радарной диаграммы активности студента.

        Параметры:
            user (User): Объект пользователя, чей профиль запрашивается.
                Ожидается, что у пользователя есть связанный профиль студента (user.student_profile).
            request (Request): Объект HTTP-запроса. Используется для передачи контекста сериализатору.

        Возвращает:
            dict: Словарь с данными профиля студента, включающий:
                - Основные поля из StudentProfileSerializer.
                - Дополнительное поле "radar_stats" с метками и значениями баллов по пяти направлениям:
                    - Общественная - social_score
                    - Учебная - academic_score
                    - Спорт - sport_score
                    - Творческая - cultural_score
                    - Научная - research_score
        """
        serializer = StudentProfileSerializer(student, context={'request': self.request})
        data = serializer.data
        data["radar_stats"] = self.get_student_radar_data(student)
        data["is_own_profile"] = is_own_profile
        
        if is_own_profile or self.request.user.groups.filter(name__in=['Department', 'Dean', 'Rectorate']).exists():
            data["email"] = student.email
            data["phone"] = getattr(student, 'phone', None)
            
        return data

    def apply_filters(self, queryset, prefix=''):
        """
        Парсинг параметров и фильтрация по факультету, курсу, группе или поиску.

        `prefix` позволяет применять те же фильтры к связанным моделям - например
        'student__' для строк SemesterScore при историческом рейтинге.
        """
        params = self.request.query_params
        filters = {}

        if params.get('faculty_id') and params.get('faculty_id') != 'all':
            filters[f'{prefix}faculty__id'] = params.get('faculty_id')
        if params.get('course') and params.get('course') != 'all':
            filters[f'{prefix}group__course'] = params.get('course')
        if params.get('group_id') and params.get('group_id') != 'all':
            filters[f'{prefix}group__id'] = params.get('group_id')

        queryset = queryset.filter(**filters)

        search = params.get('search')
        if search:
            queryset = queryset.filter(
                Q(**{f'{prefix}full_name__icontains': search}) | Q(**{f'{prefix}record_book__icontains': search})
            )

        return queryset

    def scope_filters_queryset(self, user, queryset, faculty_field='faculty', dept_field='group__specialty__department'):
        """
        Универсальный метод фильтрации по роли.
        Позволяет переопределять поля (kwargs), чтобы работать и со Student, и с Group.
        """
        if user.is_rectorate:
            return queryset # Ректорат видит всех
            
        elif hasattr(user, 'staff_profile'):
            if user.is_dean:
                # Распаковка словаря
                return queryset.filter(**{faculty_field: user.staff_profile.faculty})
            elif user.is_dept_staff:
                return queryset.filter(**{dept_field: user.staff_profile.department})
                
        return queryset.none()
        
class StudentRatingQuerySetMixin(StudentFilterMixin):
    """
    Выборка для обшего рейтинга студентов.
    Применяются фильтры apply_filters и дополнительно по категории достижения.
    Текущий семестр читается из кэша на Student; прошлый - из истории SemesterScore.
    """
    def get_requested_past_semester_id(self):
        """
        id запрошенного ПРОШЛОГО семестра (для просмотра истории рейтинга) либо None,
        если параметр не задан или указывает на текущий семестр.
        """
        semester_id = self.request.query_params.get('semester')
        if not semester_id:
            return None
        current = AcademicYear.get_current()
        if current is not None and str(current.id) == str(semester_id):
            return None
        return semester_id

    def get_base_rating_queryset(self, allow_history=True):
        category = self.request.query_params.get('category', 'common')

        past_semester_id = self.get_requested_past_semester_id() if allow_history else None
        if past_semester_id is not None:
            # Исторический рейтинг: строки SemesterScore выбранного семестра.
            queryset = SemesterScore.objects.filter(semester_id=past_semester_id).select_related(
                'student', 'student__group', 'student__faculty', 'student__user'
            )
            queryset = self.apply_filters(queryset, prefix='student__')
            return queryset.by_category(category)

        queryset = Student.objects.select_related('group', 'faculty')
        queryset = self.apply_filters(queryset)
        return queryset.by_category(category)

class StudentWithAccessMixin(StudentFilterMixin):
    """
    Получение выборки студентов в зависимости от роли
    """
    def get_allowed_students(self, user):
        queryset = Student.objects.select_related(
            'group__specialty__faculty', 'faculty', 'user'
        ).order_by('user__last_name', 'user__first_name')

        if not hasattr(user, 'staff_profile'):
            return queryset.none()
    
        # Ограничиваем область видимости (Scope)
        queryset = self.scope_filters_queryset(user, queryset)
        # Применяем фильтры из параметров (факультет, курс, группа)
        return self.apply_filters(queryset)


class DashboardStatsQuerySetMixin(StudentWithAccessMixin):
    """
    Mixin для получения данных дашборда: студенты, топ-5, документы, статистика.
    """
    def get_base_students_queryset(self, user):
        """
        Базовый queryset студентов с учётом прав доступа.
        """
        return self.get_allowed_students(user)

    def get_filtered_students_queryset(self, user):
        """
        Отфильтрованный queryset студентов (по faculty, course, group).
        """
        base_queryset = self.get_base_students_queryset(user)
        return self.apply_filters(base_queryset)

    def get_requested_semester(self):
        """
        (semester_id, is_past) для статистики/топа дашборда.

        Основной параметр - `academic_year` (как у списков заявок), но поддерживаем и
        `semester` (как у рейтинга). Если параметр не задан - берём текущий семестр
        (is_past=False). is_past=True только когда запрошен НЕ текущий семестр - тогда
        читаем историю из SemesterScore, иначе живой кэш Student.
        """
        semester_id = self.request.query_params.get('academic_year') or self.request.query_params.get('semester')
        current = AcademicYear.get_current()
        if not semester_id:
            return (current.id if current else None), False
        is_past = not (current is not None and str(current.id) == str(semester_id))
        return semester_id, is_past

    def _stats_aggregates(self):
        """Набор агрегатов статистики; per-category суммы хранятся под ключом '<code>_sum'."""
        aggregates = {
            'total_students': Count('id'),
            'avg_score': Avg('total_score'),
            'max_score': Max('total_score'),
            'min_score': Min('total_score'),
        }
        for code in Category.objects.values_list('code', flat=True):
            aggregates[f'{code}_sum'] = Sum(f'{code}_score')
        return aggregates

    def get_stats_data(self, user):
        """
        Статистика по отфильтрованным студентам за выбранный семестр.

        Текущий семестр - из живого кэша Student; прошлый - из истории SemesterScore
        (аналогично рейтингу). Помимо количества и среднего балла возвращает min/max и
        суммы баллов по каждой категории (ключ - код категории), чтобы фронт не считал
        распределение из одной страницы студентов.
        """
        filtered_queryset = self.get_filtered_students_queryset(user)
        semester_id, is_past = self.get_requested_semester()
        category_codes = list(Category.objects.values_list('code', flat=True))
        aggregates = self._stats_aggregates()

        if is_past and semester_id:
            source = SemesterScore.objects.filter(
                semester_id=semester_id,
                student__in=filtered_queryset,
            )
        else:
            source = filtered_queryset

        stats_data = source.aggregate(**aggregates)

        return {
            'total_students': stats_data['total_students'] or 0,
            'avg_score': round(stats_data['avg_score'] or 0, 2),
            'max_score': stats_data['max_score'] or 0,
            'min_score': stats_data['min_score'] or 0,
            'categories': {code: (stats_data[f'{code}_sum'] or 0) for code in category_codes},
        }

    def get_top5_students(self, user):
        """
        Топ-5 студентов за выбранный семестр (по сумме баллов).

        Текущий семестр - из живого кэша Student; прошлый - из истории SemesterScore.
        Возвращает список словарей {id, full_name, total_score} (совпадает с контрактом
        StudentSimple на фронте).
        """
        group_id = self.request.query_params.get('group_id')
        semester_id, is_past = self.get_requested_semester()

        # Топ-5 студентов
        if group_id and group_id != 'all':
            # Если выбрана конкретная группа - топ5 из этой группы
            students = self.get_filtered_students_queryset(user)
        else:
            # Если "Все" - топ5 из всех студентов в scope (без фильтра course/faculty)
            students = self.get_base_students_queryset(user)

        if is_past and semester_id:
            rows = (
                SemesterScore.objects
                .filter(semester_id=semester_id, student__in=students)
                .select_related('student')
                .order_by('-total_score', 'student__full_name')[:5]
            )
            return [
                {'id': r.student_id, 'full_name': r.student.full_name, 'total_score': r.total_score}
                for r in rows
            ]

        top = students.order_by('-total_score')[:5]
        return [
            {'id': s.id, 'full_name': s.full_name, 'total_score': s.total_score}
            for s in top
        ]

    def get_pending_documents_queryset(self, user):
        """
        Получить queryset документов на модерацию.
        """
        filtered_queryset = self.get_filtered_students_queryset(user)

        # Фильтрация по семестру (по умолчанию - текущий). Поддерживаем оба имени параметра.
        semester_id = self.request.query_params.get('semester') or self.request.query_params.get('academic_year')
        if not semester_id:
            current = AcademicYear.get_current()
            semester_id = current.id if current else None
        semester_filter = {'semester_id': semester_id} if semester_id else {}

        # Документы - всегда по отфильтрованным
        doc_status = 'pending' if user.is_dept_staff else 'approved'

        qs = Document.objects.filter(
            user__student_profile__in=filtered_queryset,
            status__code=doc_status,
            **semester_filter
        ).select_related(
            'user__student_profile',
            'user__student_profile__group'
        )

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(user__student_profile__full_name__icontains=search) |
                Q(user__student_profile__record_book__icontains=search) |
                Q(achievement__icontains=search)
            )

        return qs.order_by('-uploaded_at')

    def get_reviewed_documents_queryset(self, user):
        """
        Документы с финальным решением (подтверждены или отклонены) в области видимости сотрудника.
        """
        filtered_queryset = self.get_filtered_students_queryset(user)

        academic_year_id = self.request.query_params.get('academic_year')
        date_filter = {}

        if academic_year_id:
            ay = AcademicYear.objects.filter(id=academic_year_id).first()
            if ay:
                start = timezone.make_aware(datetime.combine(ay.start_date, time.min))
                end = timezone.make_aware(datetime.combine(ay.end_date, time.max))
                date_filter = {
                    'uploaded_at__range': (start, end)
                }

        qs = Document.objects.filter(
            user__student_profile__in=filtered_queryset,
            status__code__in=['approved', 'rejected'],
            **date_filter,
        ).select_related(
            'user__student_profile',
            'user__student_profile__group',
            'status',
            'category',
            'sub_type',
            'level',
            'result',
            'doc_type',
        ).prefetch_related('files')

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(user__student_profile__full_name__icontains=search) |
                Q(user__student_profile__record_book__icontains=search) |
                Q(achievement__icontains=search)
            )

        return qs.order_by('-uploaded_at')