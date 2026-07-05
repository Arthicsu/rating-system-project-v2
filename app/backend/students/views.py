"""
ViewSets приложения students (API /api/v1/, router — backend/api_urls.py).

Авторизация — permission-классы из core/permissions.py (scope-логика в
core/scoping.py), фильтрация — FilterSet'ы из core/filters.py + SearchFilter,
построение выборок и агрегатов — core/querysets.py, бизнес-логика — services.py.
"""
import logging

from rest_framework import mixins, status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.filters import SearchFilter
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.viewsets import GenericViewSet

from django_filters.rest_framework import DjangoFilterBackend

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema

from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page

from core import querysets
from core.filters import DocumentDashboardFilterSet, StudentFilterSet
from core.permissions import (
    CanReviewDocument,
    HasStudentScope,
    IsAchievementOwnerOrStaffInScope,
    IsStaffProfile,
)
from core.serializers import ErrorDetailSerializer, MessageSerializer
from university_structure.serializers import ReviewDocumentRequestSerializer, ReviewDocumentResponseSerializer

from . import services
from .models import Category, Document, Student
from .serializers import (
    AchievementConfigSerializer,
    AchievementUpdateSerializer,
    AchievementUploadSerializer,
    DocumentSerializer,
    PendingDocumentSerializer,
    SemesterStudentListSerializer,
    StudentProfileSerializer,
)

logger = logging.getLogger(__name__)

_SEMESTER_PARAMS = [
    OpenApiParameter('academic_year', OpenApiTypes.INT, description='ID семестра (по умолчанию — текущий)'),
    OpenApiParameter('semester', OpenApiTypes.INT, description='Синоним academic_year'),
]


@extend_schema(tags=['achievements'])
class AchievementViewSet(mixins.CreateModelMixin,
                         mixins.RetrieveModelMixin,
                         mixins.ListModelMixin,
                         mixins.DestroyModelMixin,
                         GenericViewSet):
    """
    Достижения (заявки студентов).

    - create — загрузка достижения студентом (throttle 'upload');
    - retrieve — карточка заявки (владелец или сотрудник в scope);
    - partial_update / destroy — правка/удаление своей заявки
      (чужие скрыты фильтром по владельцу: 404, существование не раскрывается);
    - list — заявки на модерацию для сотрудника (?list_type=pending|reviewed),
      в пагинированный ответ добавляются stats и top5;
    - review — решение по заявке (кафедра / декан / ректорат);
    - config — конфигурация формы загрузки (кэш 1 час).
    """
    authentication_classes = [SessionAuthentication]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_class = DocumentDashboardFilterSet
    search_fields = [
        'user__student_profile__full_name',
        'user__student_profile__record_book',
        'achievement',
    ]
    lookup_value_regex = r'\d+'

    def get_permissions(self):
        if self.action == 'review':
            return [CanReviewDocument()]
        if self.action == 'list':
            return [IsStaffProfile()]
        if self.action == 'retrieve':
            return [IsAuthenticated(), IsAchievementOwnerOrStaffInScope()]
        return [IsAuthenticated()]

    def get_throttles(self):
        if self.action == 'create':
            self.throttle_scope = 'upload'
            return [ScopedRateThrottle()]
        return []

    def get_serializer_class(self):
        if self.action == 'create':
            return AchievementUploadSerializer
        if self.action == 'partial_update':
            return AchievementUpdateSerializer
        if self.action == 'config':
            return AchievementConfigSerializer
        if self.action == 'review':
            return ReviewDocumentRequestSerializer
        return PendingDocumentSerializer

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Document.objects.none()

        if self.action == 'list':
            list_type = self.request.query_params.get('list_type', 'pending')
            if list_type == 'reviewed':
                return querysets.reviewed_documents(self.request.user, self.request)
            return querysets.pending_documents(self.request.user, self.request)

        if self.action in ('partial_update', 'destroy'):
            # Владение через фильтр: для чужих заявок — 404, существование не раскрываем.
            return Document.objects.select_related(
                'status', 'category', 'user__student_profile'
            ).filter(user=self.request.user)

        return Document.objects.select_related(
            'status', 'category', 'sub_type', 'level', 'result', 'doc_type', 'semester',
            'user__student_profile',
            'user__student_profile__group',
            'user__student_profile__group__specialty__department',
            'user__student_profile__faculty',
        ).prefetch_related('files')

    def filter_queryset(self, queryset):
        # Параметрические фильтры и поиск — только для списка модерации.
        if self.action != 'list':
            return queryset
        return super().filter_queryset(queryset)

    @extend_schema(
        request=AchievementUploadSerializer,
        responses={201: MessageSerializer, 400: ErrorDetailSerializer},
    )
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"message": "Достижение успешно загружено"}, status=status.HTTP_201_CREATED)

    @extend_schema(
        parameters=_SEMESTER_PARAMS + [
            OpenApiParameter('list_type', OpenApiTypes.STR, description="pending (по умолчанию) | reviewed"),
        ],
        responses={200: PendingDocumentSerializer(many=True)},
    )
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            response.data['stats'] = querysets.dashboard_stats(request.user, request)
            response.data['top5'] = querysets.top5_students(request.user, request)
            return response

        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'results': serializer.data,
            'stats': querysets.dashboard_stats(request.user, request),
            'top5': querysets.top5_students(request.user, request),
        })

    @extend_schema(
        request=AchievementUpdateSerializer,
        responses={200: DocumentSerializer, 403: ErrorDetailSerializer},
    )
    def partial_update(self, request, *args, **kwargs):
        doc = self.get_object()

        if doc.status.code == 'approved':
            raise PermissionDenied("Нельзя редактировать подтверждённое достижение.")

        serializer = self.get_serializer(instance=doc, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        doc = serializer.save()

        return Response(DocumentSerializer(doc).data)

    @extend_schema(responses={204: None, 403: ErrorDetailSerializer})
    def destroy(self, request, *args, **kwargs):
        doc = self.get_object()

        # Подтверждённое достижение студент удалить не может — баллы уже начислены.
        if doc.status.code == 'approved':
            raise PermissionDenied("Нельзя удалить подтверждённое достижение.")

        files = list(doc.files.all())
        doc.delete()

        for document_file in files:
            try:
                document_file.file.delete(save=False)
            except Exception:
                logger.exception("Не удалось удалить файл достижения из хранилища")

        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(
        request=ReviewDocumentRequestSerializer,
        responses={
            200: ReviewDocumentResponseSerializer,
            400: ErrorDetailSerializer,
            403: ErrorDetailSerializer,
            404: ErrorDetailSerializer,
        },
    )
    @action(detail=True, methods=['post'])
    def review(self, request, pk=None):
        document = self.get_object()  # scope проверяет CanReviewDocument.has_object_permission

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        message = services.review_document(
            document=document,
            reviewer=request.user,
            action=serializer.validated_data['action'],
            reasons=serializer.validated_data.get('reasons', []),
        )
        return Response({"message": message})

    @extend_schema(responses={200: AchievementConfigSerializer})
    @method_decorator(cache_page(60 * 60, key_prefix='achv-config'))
    @action(detail=False, methods=['get'])
    def config(self, request):
        """Конфигурация формы достижения: категории, подтипы, уровни, результаты, правила баллов."""
        categories = Category.objects.prefetch_related(
            'sub_types',
            'sub_types__rules__level',
            'sub_types__rules__result',
        )

        structure = {}
        for cat in categories:
            sub_types = []
            for st in cat.sub_types.all():
                levels, results, rules = set(), set(), []
                # Один проход по префетченным правилам вместо трёх.
                for r in st.rules.all():
                    if r.level and r.level.code != 'none':
                        levels.add(r.level.code)
                    if r.result and r.result.code != 'none':
                        results.add(r.result.code)
                    rules.append({
                        "level": r.level.code if r.level else None,
                        "result": r.result.code if r.result else None,
                        "score": r.score,
                    })
                sub_types.append({
                    "code": st.code,
                    "label": st.label,
                    "needsLevel": st.needs_level,
                    "needsResult": st.needs_result,
                    "allowedLevels": list(levels),
                    "allowedResults": list(results),
                    "scoring_rules": rules,
                })
            structure[cat.code] = {"label": cat.label, "sub_types": sub_types}

        serializer = self.get_serializer(structure)
        return Response(serializer.data)


@extend_schema(tags=['students'])
class StudentViewSet(mixins.ListModelMixin,
                     mixins.RetrieveModelMixin,
                     GenericViewSet):
    """
    Студенты.

    - list — студенты в области видимости сотрудника с фильтрами и выбором
      семестра (прошлый семестр — баллы из истории SemesterScore);
    - retrieve — полный профиль (свой или в scope сотрудника);
    - me — собственный профиль студента.
    """
    authentication_classes = [SessionAuthentication]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_class = StudentFilterSet
    search_fields = ['full_name', 'record_book']
    lookup_value_regex = r'\d+'

    def get_permissions(self):
        if self.action == 'list':
            return [IsStaffProfile()]
        if self.action == 'retrieve':
            return [IsAuthenticated(), HasStudentScope()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if getattr(self, 'swagger_fake_view', False):
            return StudentProfileSerializer

        if self.action == 'list':
            _, is_past = querysets.get_requested_semester(self.request)
            return SemesterStudentListSerializer if is_past else StudentProfileSerializer
        return StudentProfileSerializer

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Student.objects.none()

        if self.action == 'list':
            queryset = querysets.allowed_students(self.request.user)
            semester_id, is_past = querysets.get_requested_semester(self.request)
            if is_past and semester_id:
                queryset = queryset.annotate(**querysets.semester_score_annotations(semester_id))
            return queryset
        return Student.objects.select_related('user', 'faculty', 'department')

    def filter_queryset(self, queryset):
        if self.action != 'list':
            return queryset
        return super().filter_queryset(queryset)

    @extend_schema(
        parameters=_SEMESTER_PARAMS,
        responses={200: StudentProfileSerializer(many=True)},
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(responses={200: StudentProfileSerializer, 403: ErrorDetailSerializer})
    def retrieve(self, request, *args, **kwargs):
        student = self.get_object()
        is_own_profile = bool(student.user_id and student.user_id == request.user.id)
        return Response(querysets.student_full_profile(student, request, is_own_profile))

    @extend_schema(responses={200: StudentProfileSerializer, 404: ErrorDetailSerializer})
    @action(detail=False, methods=['get'])
    def me(self, request):
        student = getattr(request.user, 'student_profile', None)
        if not student:
            raise NotFound("Профиль студента не найден. Для просмотра необходима учетная запись студента.")
        return Response(querysets.student_full_profile(student, request, is_own_profile=True))
