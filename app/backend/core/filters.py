"""
FilterSet'ы (django-filter) для списочных эндпоинтов.

Имена query-параметров сохранены как в старом ручном парсинге
(faculty_id / course / group_id), включая сентинел 'all', который фронтенд
шлёт буквально (например, staff-дашборд всегда передаёт group_id='all').

Поиск (`search`) реализуется через rest_framework.filters.SearchFilter
на уровне ViewSet, а не здесь.
"""
import django_filters
from django_filters.rest_framework import FilterSet

from students.models import Document, Student
from university_structure.models import Group


class AllSentinelFilter(django_filters.CharFilter):
    """No-op при пустом значении или сентинеле 'all'."""

    def filter(self, qs, value):
        if not value or value == 'all':
            return qs
        return super().filter(qs, value)


class StudentFilterSet(FilterSet):
    faculty_id = AllSentinelFilter(field_name='faculty_id')
    course = AllSentinelFilter(field_name='group__course')
    group_id = AllSentinelFilter(field_name='group_id')

    class Meta:
        model = Student
        fields = ['faculty_id', 'course', 'group_id']


class GroupFilterSet(FilterSet):
    faculty_id = AllSentinelFilter(field_name='specialty__faculty_id')
    course = AllSentinelFilter(field_name='course')
    group_id = AllSentinelFilter(field_name='id')

    class Meta:
        model = Group
        fields = ['faculty_id', 'course', 'group_id']


class DocumentDashboardFilterSet(FilterSet):
    """Фильтры списка заявок на дашборде — по атрибутам студента-владельца."""
    faculty_id = AllSentinelFilter(field_name='user__student_profile__faculty_id')
    course = AllSentinelFilter(field_name='user__student_profile__group__course')
    group_id = AllSentinelFilter(field_name='user__student_profile__group_id')

    class Meta:
        model = Document
        fields = ['faculty_id', 'course', 'group_id']
