from datetime import datetime, time

from django.db.models import Prefetch, Avg, Count, Q
from django.utils import timezone

from students.models import Student, Category, Document
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

    def apply_filters(self, queryset):
        """
        Парсинг параметров и фильтрация по факультету, курсу, группе или поиску.
        """
        params = self.request.query_params
        filters = {}
        
        if params.get('faculty_id') and params.get('faculty_id') != 'all':
            filters['faculty__id'] = params.get('faculty_id')
        if params.get('course') and params.get('course') != 'all':
            filters['group__course'] = params.get('course')
        if params.get('group_id') and params.get('group_id') != 'all':
            filters['group__id'] = params.get('group_id')
            
        queryset = queryset.filter(**filters)

        search = params.get('search')
        if search:
            queryset = queryset.filter(
                Q(full_name__icontains=search) | Q(record_book__icontains=search)
            )

        return queryset

    def scope_filters_queryset(self, user, queryset, faculty_field='faculty', dept_field='department'):
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
    Применяются фильтры apply_filters и дополнительно по категории достижения
    """
    def get_base_rating_queryset(self):
        category = self.request.query_params.get('category', 'common')
        
        queryset = Student.objects.select_related('group', 'faculty')
        
        queryset = self.apply_filters(queryset)
        return queryset.by_category(category)

class StudentWithAccessMixin(StudentFilterMixin):
    """
    Получение выборки студентов в зависимости от роли
    """
    def get_allowed_students(self, user):
        queryset = Student.objects.select_related(
            'group', 'faculty', 'department', 'user'
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

    def get_stats_data(self, user):
        """
        Получить статистику по отфильтрованным студентам.
        """
        filtered_queryset = self.get_filtered_students_queryset(user)
        
        # Считаем статистику по отфильтрованным студентам
        stats_data = filtered_queryset.aggregate(
            total_students=Count('id'),
            avg_score=Avg('total_score')
        )
        
        return {
            'total_students': stats_data['total_students'] or 0,
            'avg_score': round(stats_data['avg_score'] or 0, 2)
        }

    def get_top5_students(self, user):
        """
        Получить топ-5 студентов.
        """
        group_id = self.request.query_params.get('group_id')
        
        # Топ-5 студентов
        if group_id and group_id != 'all':
            # Если выбрана конкретная группа - топ5 из этой группы
            top5_queryset = self.get_filtered_students_queryset(user)
        else:
            # Если "Все" - топ5 из всех студентов в scope (без фильтра course/faculty)
            top5_queryset = self.get_base_students_queryset(user)
        
        return top5_queryset.order_by('-total_score')[:5]

    def get_pending_documents_queryset(self, user):
        """
        Получить queryset документов на модерацию.
        """
        filtered_queryset = self.get_filtered_students_queryset(user)
        
        # Фильтрация по академическому году
        academic_year_id = self.request.query_params.get('academic_year')
        date_filter = {}
        
        if academic_year_id:
            ay = AcademicYear.objects.filter(id=academic_year_id).first()
            if ay:
                # uploaded_at - DateTimeField при USE_TZ=True, поэтому границы переводим в aware-datetime (конец интервала включает весь день)
                start = timezone.make_aware(datetime.combine(ay.start_date, time.min))
                end = timezone.make_aware(datetime.combine(ay.end_date, time.max))
                date_filter = {
                    'uploaded_at__range': (start, end)
                }
        
        # Документы - всегда по отфильтрованным
        doc_status = 'pending' if user.is_dept_staff else 'approved'
        
        qs = Document.objects.filter(
            user__student_profile__in=filtered_queryset,
            status__code=doc_status,
            **date_filter
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