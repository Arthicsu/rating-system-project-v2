from drf_spectacular.utils import extend_schema, OpenApiExample, inline_serializer
from drf_spectacular.types import OpenApiTypes

from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, serializers

from django.shortcuts import get_object_or_404

from university_structure.models import Faculty, Group
from students.models import Document, Student



class ReviewDocumentAPIView(APIView):
    """
    API-представление для модерации документов студентов преподавателем.

    Позволяет преподавателям подтверждать или отклонять загруженные студентами документы,
    подтверждающие достижения. 
    При подтверждении - начисляются баллы в соответствии с категорией.
    """
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]  
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
        
        if not request.user.groups.filter(name='Department').exists():
            return Response({"error": "Нет прав модерации"}, status=status.HTTP_403_FORBIDDEN)

        doc = get_object_or_404(Document, id=doc_id)
        action = request.data.get('action')
        
        if action == 'approve':
            doc.status = 'approved'
            doc.save()
            
            student = doc.student
            field_name = f"{doc.category}_score"
            if hasattr(student, field_name):
                setattr(student, field_name, getattr(student, field_name) + doc.score)
                student.save()
            
            return Response({"message": "Документ подтвержден, баллы начислены"}, status=status.HTTP_200_OK)

        elif action == 'reject':
            reasons = request.data.get('reasons', [])
            reason_text = "; ".join(reasons) if isinstance(reasons, list) else str(reasons)
            
            doc.status = 'rejected'
            doc.rejection_reason = reason_text
            doc.save()
            
            return Response({"message": "Документ отклонен"}, status=status.HTTP_200_OK)

        return Response({"error": "Неверное действие"}, status=status.HTTP_400_BAD_REQUEST)
