from students.models import Student

class StudentFilterMixin:
    """Парсинг параметров и фильтрация по факультету, курсу или группе."""
    def apply_filters(self, queryset):
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
        queryset = Student.objects.select_related('group', 'faculty').all()
        
        # Сначала фильтруем, потом сортируем по категории
        queryset = self.apply_filters(queryset)
        return queryset.by_category(category)

class StudentWithAccessMixin(StudentFilterMixin):
    """Получение выборки студентов в зависимости от роли"""
    def get_allowed_students(self, user):
        queryset = Student.objects.select_related(
            'group__specialty__faculty', 'faculty', 'user'
        )

        if not hasattr(user, 'staff_profile'):
            return queryset.none()
    
        # Ограничиваем область видимости (Scope)
        queryset = self.scope_filters_queryset(user, queryset)
        # Применяем фильтры из параметров (факультет, курс, группа)
        return self.apply_filters(queryset)