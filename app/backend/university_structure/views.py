"""
ViewSets приложения university_structure (API /api/v1/, router — backend/api_urls.py):
профиль сотрудника и справочники структуры вуза.

Модерация заявок живёт в AchievementViewSet.review (students/views.py),
экспорт рейтинга — в RatingViewSet.export (users/views.py).
"""
from drf_spectacular.utils import extend_schema

from rest_framework import mixins, viewsets
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from django.db.models import Exists, OuterRef
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.views.decorators.vary import vary_on_headers

from django_filters.rest_framework import DjangoFilterBackend

from core import scoping
from core.filters import GroupFilterSet
from core.permissions import IsStaffProfile

from students.models import Student

from .models import AcademicYear, Group, RejectionReason
from .serializers import (
    AcademicYearSerializer,
    GroupSerializer,
    RejectionReasonSerializer,
    StaffProfileResponseSerializer,
    StaffSerializer,
)


@extend_schema(tags=['staff'])
class StaffViewSet(viewsets.ViewSet):
    """Профиль сотрудника (деканат / кафедра / ректорат)."""
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsStaffProfile]

    @extend_schema(responses={200: StaffProfileResponseSerializer})
    @action(detail=False, methods=['get'])
    def me(self, request):
        staff = request.user.staff_profile  # гарантирован IsStaffProfile

        data = StaffSerializer(staff).data
        data.update({
            "roles": list(staff.user.groups.values_list('name', flat=True)) if staff.user else [],
            "is_own_profile": True,
            "is_staff": staff.user.is_staff if staff.user else False,
            "type": "staff",
        })
        return Response(data)


@extend_schema(tags=['groups'])
class GroupViewSet(mixins.ListModelMixin, GenericViewSet):
    """
    Учебные группы, доступные сотруднику (в его scope, только с студентами).
    Кэш 5 минут, per-cookie (данные зависят от роли).
    """
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsStaffProfile]
    serializer_class = GroupSerializer
    pagination_class = None
    filter_backends = [DjangoFilterBackend]
    filterset_class = GroupFilterSet

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Group.objects.none()

        # Подзапрос вместо join таблицы студентов — без дублей строк.
        has_students_subquery = Student.objects.filter(group=OuterRef('pk'))

        queryset = Group.objects.select_related('specialty__faculty').annotate(
            has_students=Exists(has_students_subquery)
        ).filter(has_students=True).order_by('course', 'name')

        return scoping.scope_queryset(
            self.request.user, queryset,
            faculty_field='specialty__faculty',
            dept_field='specialty__department',
        )

    @extend_schema(responses={200: GroupSerializer(many=True)})
    @method_decorator(cache_page(60 * 5, key_prefix='groups'))
    @method_decorator(vary_on_headers('Cookie'))
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)


@extend_schema(tags=['rejection-reasons'])
class RejectionReasonViewSet(mixins.ListModelMixin, GenericViewSet):
    """Справочник активных причин отклонения заявок (кэш 2 часа)."""
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsStaffProfile]
    serializer_class = RejectionReasonSerializer
    queryset = RejectionReason.objects.filter(is_active=True)
    pagination_class = None

    @extend_schema(responses={200: RejectionReasonSerializer(many=True)})
    @method_decorator(cache_page(60 * 60 * 2, key_prefix='rejection-reasons'))
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)


@extend_schema(tags=['academic-years'])
class AcademicYearViewSet(mixins.ListModelMixin, GenericViewSet):
    """Учебные периоды для селектора семестра (кэш 2 часа)."""
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsStaffProfile]
    serializer_class = AcademicYearSerializer
    queryset = AcademicYear.objects.all()
    pagination_class = None

    @extend_schema(responses={200: AcademicYearSerializer(many=True)})
    @method_decorator(cache_page(60 * 60 * 2, key_prefix='academic-years'))
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)
