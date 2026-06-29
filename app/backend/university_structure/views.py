from drf_spectacular.utils import extend_schema
from drf_spectacular.types import OpenApiTypes

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.generics import GenericAPIView, ListAPIView
from rest_framework.response import Response
from rest_framework import status

from django.shortcuts import get_object_or_404
from django.db import transaction
from django.http import HttpResponse
from django.db.models import Exists, OuterRef
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page

from .serializers import (
    FacultySerializer, DepartmentSerializer, SpecialtySerializer, GroupSerializer, 
    StaffSerializer, RejectionReasonSerializer, AcademicYearSerializer, 
    ReviewDocumentRequestSerializer, StaffProfileResponseSerializer,
    ReviewDocumentResponseSerializer, ReviewDocumentErrorSerializer
)
from .models import Faculty, Group, RejectionReason, AcademicYear
from students.models import Document, Student, DocumentStatus
from students.serializers import DocumentSerializer, PendingDocumentSerializer, StudentProfileSerializer, StudentRatingSerializer, CategorySerializer

from core.pagination import StandardResultsSetPagination
from core.export_rating_excel import generate_rating_excel_pandas
from core.students_query_set_mixin import StudentFilterMixin, StudentWithAccessMixin, StudentRatingQuerySetMixin, DashboardStatsQuerySetMixin
from core.scope_permission_mixin import ScopePermissionMixin
from core.permissions import IsStaffProfile


pagination_class = StandardResultsSetPagination

class StaffProfileAPIView(ScopePermissionMixin, GenericAPIView):
    """
    API для получения профиля сотрудника (деканат, кафедра, ректорат).

    Параметры:
        - request: Объект HTTP-запроса с аутентифицированным пользователем.

    Возвращает:
        - JSON-ответ с полями из сериализатора и мета-данные
    """
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsStaffProfile]
    serializer_class = StaffSerializer
    pagination_class = None

    @extend_schema(
        responses={200: StaffProfileResponseSerializer}
    )
    def get(self, request):
        user = request.user

        staff = getattr(user, 'staff_profile', None)

        if not staff:
            return Response({"message": "Доступ запрещён. Для просмотра необходима учетная запись сотрудника вуза."}, status=status.HTTP_403_FORBIDDEN)
        
        is_own_profile = (staff.user_id == user.id)

        # if not is_own_profile and not staff:
        #     return Response({"message": "Доступ запрещён"}, status=status.HTTP_403_FORBIDDEN)    


        # Сериализация данных из модели
        serializer = self.get_serializer(staff)
        response_data = serializer.data

        # Мета-данные
        response_data.update({
            "roles": list(staff.user.groups.values_list('name', flat=True)) if staff.user else [],
            "is_own_profile": is_own_profile,
            "is_staff": staff.user.is_staff if staff.user else False,
            "type": "staff"
        })

        return Response(response_data, status=status.HTTP_200_OK)

class RatingExportAPIView(StudentRatingQuerySetMixin, GenericAPIView):
    permission_classes = [IsStaffProfile]
    authentication_classes = [SessionAuthentication]
    pagination_class = None

    @extend_schema(
        summary="Экспорт рейтинга в Excel",
        responses={
            200: OpenApiTypes.BINARY
        }
    )
    def get(self, request, *args, **kwargs):
        queryset = self.get_base_rating_queryset()
        excel_bytes = generate_rating_excel_pandas(queryset)

        response = HttpResponse(
            excel_bytes,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="student_rating.xlsx"'
        return response

class ReviewDocumentAPIView(ScopePermissionMixin, GenericAPIView):
    """
    API-представление для модерации документов студентов преподавателем.

    Позволяет преподавателям подтверждать или отклонять загруженные студентами документы,
    подтверждающие достижения. 
    При подтверждении - начисляются баллы в соответствии с категорией.
    """
    
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsStaffProfile]
    serializer_class = ReviewDocumentRequestSerializer
    pagination_class = None
    lookup_url_kwarg = 'doc_id'
        
    @extend_schema(
        request=ReviewDocumentRequestSerializer,
        responses={
            200: ReviewDocumentResponseSerializer,
            400: ReviewDocumentErrorSerializer,
            403: ReviewDocumentErrorSerializer,
            404: ReviewDocumentErrorSerializer,
        }
    )
    @transaction.atomic
    def post(self, request, doc_id):
        """
        Обрабатывает POST-запрос на модерацию документа (подтверждение или отклонение).

        Только пользователи с ролью преподавателя могут выполнять это действие.
        В зависимости от переданного действия:
        - 'approve': документ помечается как подтверждённый, и соответствующие баллы добавляются студенту.
        - 'reject': документ отклоняется с указанием причин.

        Параметры:
        request (Request): HTTP-запрос, содержащий:
            - action (str): Действие - 'approve' или 'reject'.
            - reasons (list or str, опционально): Причины отклонения (для действия 'reject').
        doc_id (int): Идентификатор документа, который необходимо проверить.

        Возвращает:
        Response:
            - 200 OK: Действие выполнено успешно.
            - 403 Forbidden: Пользователь не является преподавателем.
            - 400 Bad Request: Передано неверное или неизвестное действие.
            - 404 Not Found: Документ с таким ID не найден.

        Логика:
        - Проверяется, что текущий пользователь - преподаватель.
        - Находится документ по doc_id.
        - При подтверждении:
            * Статус меняется на 'approved'.
            * Баллы из документа добавляются к соответствующему полю студента (учебные, научные и т.д.).
        - При отклонении:
            * Статус меняется на 'rejected'.
            * Указанные причины сохраняются в rejection_reason.
        """
        doc = get_object_or_404(Document.objects.select_related('status', 'category', 'user__student_profile', 'user__student_profile__faculty', 'user__student_profile__department'), id=doc_id)
        
        if not self.check_staff_scope(request.user, doc):
            return Response({"error": "Документ находится за пределами вашей области модерации"}, status=status.HTTP_403_FORBIDDEN)

        action = request.data.get('action')
        if action not in ('approve', 'reject'):
            return Response({"error": "Неверное действие"}, status=status.HTTP_400_BAD_REQUEST)

        status_pending = get_object_or_404(DocumentStatus, code='pending')
        status_approved = get_object_or_404(DocumentStatus, code='approved')
        status_rejected = get_object_or_404(DocumentStatus, code='rejected')

        student = getattr(doc.user, 'student_profile', None)
        current_status = doc.status.code

        def adjust_score(add_points: bool):
            if student is None:
                return
            field_name = f"{doc.category.code}_score"
            if hasattr(student, field_name):
                delta = doc.score if add_points else -doc.score
                setattr(student, field_name, max(0, getattr(student, field_name) + delta))
                student.save()

        if action == 'approve':
            if current_status == 'approved':
                return Response({"error": "Документ уже подтверждён"}, status=status.HTTP_400_BAD_REQUEST)

            if current_status == 'pending' and not request.user.is_dept_staff:
                return Response(
                    {"error": "Подтверждать новые заявки может только кафедра"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            doc.status = status_approved
            doc.rejection_reason = ''
            doc.verified_by = request.user
            doc.save()
            adjust_score(add_points=True)

            return Response({"message": "Документ подтверждён, баллы начислены"}, status=status.HTTP_200_OK)

        reasons = request.data.get('reasons', [])
        reason_text = "; ".join(reasons) if isinstance(reasons, list) else str(reasons)

        if current_status == 'rejected':
            return Response({"error": "Документ уже отклонён"}, status=status.HTTP_400_BAD_REQUEST)

        if not reason_text:
            return Response({"error": "Укажите причину отклонения"}, status=status.HTTP_400_BAD_REQUEST)

        if current_status == 'approved':
            adjust_score(add_points=False)
            if request.user.is_dean or request.user.is_rectorate:
                doc.status = status_pending
                message = "Решение отменено. Заявка возвращена на рассмотрение, баллы вычтены."
            else:
                doc.status = status_rejected
                message = "Документ отклонён, баллы вычтены."
        elif current_status == 'pending':
            doc.status = status_rejected
            message = "Документ отклонён."
        else:
            return Response({"error": "Нельзя отклонить документ в текущем статусе"}, status=status.HTTP_400_BAD_REQUEST)

        doc.rejection_reason = reason_text
        doc.verified_by = request.user
        doc.save()

        return Response({"message": message}, status=status.HTTP_200_OK)

@method_decorator(cache_page(60 * 60 * 2), name='dispatch')  
class RejectionReasonListView(ListAPIView):
    permission_classes = [IsStaffProfile]
    authentication_classes = [SessionAuthentication]
    serializer_class = RejectionReasonSerializer
    queryset = RejectionReason.objects.filter(is_active=True)
    pagination_class = None

    @extend_schema(
        responses={200: RejectionReasonSerializer(many=True)}
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

@method_decorator(cache_page(60 * 60 * 2), name='dispatch')  
class AcademicYearListView(ListAPIView):
    permission_classes = [IsStaffProfile]
    authentication_classes = [SessionAuthentication]
    serializer_class = AcademicYearSerializer
    queryset = AcademicYear.objects.all()
    pagination_class = None

    @extend_schema(
        responses={200: AcademicYearSerializer(many=True)}
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

@method_decorator(cache_page(60 * 5), name='dispatch')  
class FilteredGroupListAPIView(StudentFilterMixin, ListAPIView):
    """
    Список доступных учебных групп.
    Возвращает список групп, доступных текущему сотруднику (с учетом факультета/кафедры и наличия студентов).
    """ 
    permission_classes = [IsStaffProfile]
    authentication_classes = [SessionAuthentication]
    serializer_class = GroupSerializer
    pagination_class = None

    @extend_schema(
        responses={200: GroupSerializer(many=True)}
    )
    def get_queryset(self):
        user = self.request.user
        params = self.request.query_params
        
        # Подзапрос на наличие студентов в группе
        has_students_subquery = Student.objects.filter(group=OuterRef('pk'))
        
        # Основной запрос без join таблицы студентов
        queryset = Group.objects.select_related('specialty__faculty').annotate(
            has_students=Exists(has_students_subquery)
        ).filter(has_students=True).order_by('course', 'name')

        # Фильтрация по параметрам (course, faculty_id)
        if params.get('faculty_id') and params.get('faculty_id') != 'all':
            queryset = queryset.filter(specialty__faculty_id=params.get('faculty_id'))
        if params.get('course') and params.get('course') != 'all':
            queryset = queryset.filter(course=params.get('course'))
        if params.get('group_id') and params.get('group_id') != 'all':
            queryset = queryset.filter(id=params.get('group_id'))

        return self.scope_filters_queryset(
            user, queryset, 
            faculty_field='specialty__faculty', 
            dept_field='specialty__department'
        )

class FilteredStudentListAPIView(StudentWithAccessMixin, ListAPIView):
    permission_classes = [IsStaffProfile]
    authentication_classes = [SessionAuthentication]
    serializer_class = StudentProfileSerializer

    @extend_schema(
        responses={200: StudentProfileSerializer(many=True)}
    )
    def get_queryset(self):
        return self.get_allowed_students(self.request.user)

class FilteredDashboardStatsAPIView(DashboardStatsQuerySetMixin, ListAPIView):
    """
    API для получения статистики и списка документов на модерацию.
    
    Возвращает агрегированную статистику, топ-5 студентов и документы на модерацию.
    Поддерживает фильтрацию по faculty_id, course, group_id.
    Query-параметр list_type:
      - pending (по умолчанию) — заявки на рассмотрение;
      - reviewed — уже рассмотренные (approved/rejected).
    """
    permission_classes = [IsStaffProfile]
    authentication_classes = [SessionAuthentication]
    serializer_class = PendingDocumentSerializer

    def get_queryset(self):
        user = self.request.user
        list_type = self.request.query_params.get('list_type', 'pending')
        if list_type == 'reviewed':
            return self.get_reviewed_documents_queryset(user)
        return self.get_pending_documents_queryset(user)

    @extend_schema(
        responses={200: PendingDocumentSerializer(many=True)}
    )
    def get(self, request, *args, **kwargs):
        # Получаем queryset документов на модерацию
        queryset = self.get_queryset()
        
        # Пропускаем документы через пагинатор
        page = self.paginate_queryset(queryset)
        
        if page is not None:
            # Если пагинация сработала, сериализуем только текущую страницу
            serializer = self.get_serializer(page, many=True)
            
            # Получаем стандартный ответ пагинатора (с count, next, previous, results)
            response = self.get_paginated_response(serializer.data)
            
            # Добавляем статистику в ответ пагинатора
            response.data['stats'] = self.get_stats_data(request.user)
            response.data['top5'] = StudentProfileSerializer(
                self.get_top5_students(request.user), 
                many=True, 
                context={'request': request}
            ).data
            
            return response

        # Если пагинатор отключен - Fallback
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'results': serializer.data,
            'stats': self.get_stats_data(request.user),
            'top5': StudentProfileSerializer(
                self.get_top5_students(request.user), 
                many=True, 
                context={'request': request}
            ).data
        })