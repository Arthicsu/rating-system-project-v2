from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.db.models import F, ExpressionWrapper, IntegerField

from students.models import Student

class StudentRatingQuerySetMixin:
    def get_base_rating_queryset(self):
        params = self.request.query_params
        faculty = params.get('faculty', 'all')
        course = params.get('course', 'all')
        group = params.get('group', 'all')
        category = params.get('category', 'common')

        queryset = Student.objects.select_related('group', 'faculty').all()
        
        # Фильтры
        if faculty != 'all':
            queryset = queryset.filter(faculty__short_name=faculty)
        if course != 'all':
            queryset = queryset.filter(group__course=course)
        if group != 'all':
            queryset = queryset.filter(group__id=group)

        # Медленная сортировка (ну рили)
        if category == 'common':
            queryset = queryset.annotate(
                _db_total_score=ExpressionWrapper(
                    F('academic_score') + F('social_score') + 
                    F('sport_score') + F('research_score') + F('cultural_score'),
                    output_field=IntegerField()
                )
            ).order_by('-_db_total_score', 'full_name')
        else:
            sort_field = f"{category}_score"
            queryset = queryset.annotate(_db_total_score=F(sort_field)).order_by(f"-{sort_field}", "full_name")
            
        return queryset