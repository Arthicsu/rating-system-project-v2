from django.db.models import Prefetch
from students.models import Student, Category, Document
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
        Парсинг параметров и фильтрация по факультету, курсу или группе.
        """
        params = self.request.query_params
        filters = {}
        
        if params.get('faculty_id') and params.get('faculty_id') != 'all':
            filters['faculty__id'] = params.get('faculty_id')
        if params.get('course') and params.get('course') != 'all':
            filters['group__course'] = params.get('course')
        if params.get('group_id') and params.get('group_id') != 'all':
            filters['group__id'] = params.get('group_id')
            
        return queryset.filter(**filters)

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
    Применяются фильтры apply_filters и дополнительно по категории достижения
    """
    def get_base_rating_queryset(self):
        category = self.request.query_params.get('category', 'common')
        
        # Берем данные
        queryset = Student.objects.select_related('group', 'faculty').order_by('user__last_name', 'user__first_name')
        
        # Сначала фильтруем, потом сортируем по категории
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