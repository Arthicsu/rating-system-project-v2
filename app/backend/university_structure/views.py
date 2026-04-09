from drf_spectacular.utils import extend_schema, OpenApiExample, OpenApiParameter, inline_serializer
from drf_spectacular.types import OpenApiTypes

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.generics import GenericAPIView, ListAPIView, CreateAPIView, RetrieveAPIView, DestroyAPIView
from rest_framework.response import Response
from rest_framework import status, serializers

from django.shortcuts import get_object_or_404
from django.db import transaction
from django.http import HttpResponse
from django.db.models import Avg, F, Count, Q, ExpressionWrapper, IntegerField, Sum, Value, Exists, OuterRef
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.views.decorators.vary import vary_on_headers

from .serializers import FacultySerializer, DepartmentSerializer, SpecialtySerializer, GroupSerializer, StaffSerializer, RejectionReasonSerializer, AcademicYearSerializer
from .models import Faculty, Group, RejectionReason, AcademicYear
from students.models import Document, Student, DocumentStatus
from students.serializers import DocumentSerializer, PendingDocumentSerializer, StudentProfileSerializer, StudentRatingSerializer, CategorySerializer

from core.pagination import StandardResultsSetPagination
from core.export_rating_excel import generate_rating_excel_pandas
from core.students_query_set_mixin import StudentFilterMixin, StudentWithAccessMixin, StudentRatingQuerySetMixin


pagination_class = StandardResultsSetPagination

class RatingExportAPIView(StudentRatingQuerySetMixin, GenericAPIView):
    permission_classes = [AllowAny]
    authentication_classes = [SessionAuthentication]
    pagination_class = None

    @extend_schema(summary="Экспорт рейтинга в Excel")
    def get(self, request, *args, **kwargs):
        queryset = self.get_base_rating_queryset()
        excel_bytes = generate_rating_excel_pandas(queryset)

        response = HttpResponse(
            excel_bytes,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="student_rating.xlsx"'
        return response

class ReviewDocumentAPIView(APIView):
    """
    API-представление для модерации документов студентов преподавателем.

    Позволяет преподавателям подтверждать или отклонять загруженные студентами документы,
    подтверждающие достижения. 
    При подтверждении - начисляются баллы в соответствии с категорией.
    """
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]  
    pagination_class = None
    @extend_schema(
            summary="Модерация документа",
            description="Подтверждение или отклонение документа. При подтверждении начисляются баллы.",
            request=inline_serializer(
                name='ReviewDocumentRequest',
                fields={
                    'action': serializers.ChoiceField(choices=['approve', 'reject']),
                    'reasons': serializers.ListField(
                        child=serializers.CharField(), 
                        required=False, 
                        help_text="Список причин при отклонении"
                    )
                }
            ),
            responses={
                200: OpenApiTypes.OBJECT,
                400: OpenApiTypes.OBJECT,
                403: OpenApiTypes.OBJECT,
                404: OpenApiTypes.OBJECT,
            },
            examples=[
                OpenApiExample(
                    "Пример отклонения",
                    value={
                        "action": "reject",
                        "reasons": ["Неверно указано достижение / уровень"]
                    },
                    request_only=True,
                ),
                OpenApiExample(
                    "Успешный ответ (approve)",
                    value={"message": "Документ подтвержден, баллы начислены"},
                    response_only=True,
                )
            ]
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

        Пример тела запроса для подтверждения:
            {"action": "approve"}

        Пример тела запроса для отклонения:
            {"action": "reject", "reasons": ["Неверный документ", "Нечитаемый файл"]}

        Особенности:
            - Используется сессионная аутентификация и проверка прав доступа.
            - Начисление баллов происходит строго по категории документа.
            - Повторное подтверждение уже подтверждённого документа игнорируется.
        """
        is_staff = hasattr(request.user, 'staff_profile')
        if not is_staff:
            return Response({"error": "Нет прав модерации"}, status=status.HTTP_403_FORBIDDEN)

        doc = get_object_or_404(Document.objects.select_related('status', 'category', 'user__student_profile'), id=doc_id)
        action = request.data.get('action')

        status_pending = get_object_or_404(DocumentStatus, code='pending')
        status_approved = get_object_or_404(DocumentStatus, code='approved')
        status_rejected = get_object_or_404(DocumentStatus, code='rejected')

        student = getattr(doc.user, 'student_profile', None)

        # позже заменим ответ
        if request.user.is_dept_staff:
            if doc.status.code != 'pending':
                return Response({"error": "Кафедра может обрабатывать только новые заявки (pending)"}, status=status.HTTP_400_BAD_REQUEST)        
            
            if action == 'approve':
                doc.status = status_approved
                doc.verified_by = request.user
                doc.save()
                
                field_name = f"{doc.category.code}_score"
                if hasattr(student, field_name):
                    setattr(student, field_name, getattr(student, field_name) + doc.score) 
                    student.save()
                
                return Response({"message": "Документ подтвержден кафедрой, баллы начислены"}, status=status.HTTP_200_OK)

            elif action == 'reject':
                reasons = request.data.get('reasons', [])
                reason_text = "; ".join(reasons) if isinstance(reasons, list) else str(reasons)
                
                doc.status= status_rejected
                doc.rejection_reason = reason_text
                doc.verified_by = request.user
                doc.save()
                
                return Response({"message": "Документ отклонен кафедрой"}, status=status.HTTP_200_OK)
            return Response({"error": "Неверное действие для кафедры"}, status=status.HTTP_400_BAD_REQUEST)
    
        if request.user.is_dean or request.user.is_rectorate:
            if action == 'reject':
                if doc.status.code == 'approved':
                    field_name = f"{doc.category.code}_score"
                    if hasattr(student, field_name):
                        new_score = max(0, getattr(student, field_name) - doc.score)
                        setattr(student, field_name, new_score)
                        student.save()
                
                reasons = request.data.get('reasons', [])
                reason_text = "; ".join(reasons) if isinstance(reasons, list) else str(reasons)
                
                doc.status = status_pending 
                doc.rejection_reason = f"Отклонено {request.user}: {reason_text}"
                doc.verified_by = request.user
                doc.save()
                
                return Response({"message": "Решение отменено руководством. Заявка возвращена на рассмотрение, баллы вычтены."}, status=status.HTTP_200_OK)
            return Response({"error": "Руководство может только отклонять заявки"}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"error": "Неизвестная ошибка"}, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(cache_page(60 * 60 * 2), name='dispatch')  
class RejectionReasonListView(ListAPIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [SessionAuthentication]
    serializer_class = RejectionReasonSerializer
    queryset = RejectionReason.objects.filter(is_active=True)
    pagination_class = None

    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

@method_decorator(cache_page(60 * 60 * 2), name='dispatch')  
class AcademicYearListView(ListAPIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [SessionAuthentication]
    serializer_class = AcademicYearSerializer
    queryset = AcademicYear.objects.all()
    pagination_class = None

    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

class FilteredGroupListAPIView(StudentFilterMixin, ListAPIView):
    """
    Список доступных учебных групп.
    Возвращает список групп, доступных текущему сотруднику (с учетом факультета/кафедры и наличия студентов).
    """ 
    permission_classes = [IsAuthenticated]
    authentication_classes = [SessionAuthentication]
    serializer_class = GroupSerializer
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        
        # Подзапрос на наличие студенты в группе
        has_students_subquery = Student.objects.filter(group=OuterRef('pk'))
        
        # Основной запрос без join таблицы студентов
        queryset = Group.objects.select_related('specialty__faculty').annotate(
            has_students=Exists(has_students_subquery)
        ).filter(has_students=True)

        return self.scope_filters_queryset(
            user, queryset, 
            faculty_field='specialty__faculty', 
            dept_field='specialty__department'
        )

class FilteredStudentListAPIView(StudentWithAccessMixin, ListAPIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [SessionAuthentication]
    serializer_class = StudentProfileSerializer

    def get_queryset(self):
        return self.get_allowed_students(self.request.user)

class FilteredDashboardStatsAPIView(StudentWithAccessMixin, GenericAPIView):
    """
    API для получения статистики и списка документов на модерацию.
    Реагирует на GET-параметры фильтрации (faculty, course, group_id).
    Возвращает агрегированную статистику и документы на основе текущих фильтров.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [SessionAuthentication]

    def get(self, request, *args, **kwargs):
        user = request.user
        
        # Получаем студентов с учетом прав и фильтров
        students_queryset = self.get_allowed_students(user)

        # Считаем статистику
        stats_data = students_queryset.aggregate(
            total_students=Count('id'),
            avg_score=Avg('total_score') 
        )
        
        # В зависимости от роли разные статусы документов для фильтрования
        doc_status = 'pending' if user.is_dept_staff else 'approved'
        # Получаем отфильтрованные документы
        pending_docs_queryset = Document.objects.filter(
            user__student_profile__in=students_queryset,
            status__code=doc_status
        ).select_related('user__student_profile', 'user__student_profile__group')

        # Пропускаем документы через пагинатор
        page = self.paginate_queryset(pending_docs_queryset)

        if page is not None:
            # Если пагинация сработала, сериализуем только текущую страницу
            serializer = PendingDocumentSerializer(page, many=True, context={'request': request})
            
            # Получаем стандартный ответ пагинатора (с count, next, previous, results)
            response = self.get_paginated_response(serializer.data)
            
            # Добавляем статистику в ответ пагинатора
            response.data['stats'] = stats_data
            
            response.data['pending_documents'] = response.data.pop('results')
            
            return response

        # Если пагинатор отключен - Fallback
        serializer = PendingDocumentSerializer(pending_docs_queryset, many=True, context={'request': request})
        return Response({
            "stats": stats_data,
            "pending_documents": serializer.data
        })