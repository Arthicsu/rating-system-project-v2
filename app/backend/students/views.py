from rest_framework.response import Response
from rest_framework import status, serializers
from rest_framework.decorators import api_view
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import authentication_classes, permission_classes
from rest_framework.views import APIView
from rest_framework.generics import GenericAPIView, ListAPIView, CreateAPIView, RetrieveAPIView, DestroyAPIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.throttling import ScopedRateThrottle

from drf_spectacular.utils import extend_schema

from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.views.decorators.vary import vary_on_headers
from django.shortcuts import get_object_or_404

from .serializers import DocumentSerializer, StudentProfileSerializer, CategorySerializer, AchievementConfigSerializer, AchievementUploadSerializer, AchievementUpdateSerializer
from .models import Document, Student, Level, AchievementResult, DocType, Category, AchievementType, DocumentStatus, DocumentFile
from .scoring import calculate_achievement_score
from core.students_query_set_mixin import StudentFilterMixin
from core.scope_permission_mixin import ScopePermissionMixin

import json, uuid, logging

logger = logging.getLogger(__name__)


@method_decorator(cache_page(60 * 60), name='dispatch')  
class AchievementConfigAPIView(GenericAPIView):
    """
    API-представление для получения конфигурации достижений.

    Возвращает структурированные данные, необходимые клиенту для построения динамической формы ввода информации о достижении студента.

    Включает иерархию категорий и подтипов, а также списки допустимых значений для уровней, результатов и типов документов.
    """
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = AchievementConfigSerializer
    pagination_class = None

    @extend_schema(
        responses={200: AchievementConfigSerializer}
    )
    def get(self, request):
        structure = {
            cat.code: {
                "label": cat.label,
                "sub_types": [
                    {
                        "code": st.code,
                        "label": st.label,
                        "needsLevel": st.needs_level,
                        "needsResult": st.needs_result,
                        "allowedLevels": list(set(
                            r.level.code for r in st.rules.all() 
                            if r.level and r.level.code != 'none'
                        )),
                        "allowedResults": list(set(
                            r.result.code for r in st.rules.all() 
                            if r.result and r.result.code != 'none'
                        )),
                        "scoring_rules": [
                            {
                                "level": r.level.code if r.level else None,
                                "result": r.result.code if r.result else None,
                                "score": r.score
                            }
                            for r in st.rules.all()
                        ]
                    }
                    for st in cat.sub_types.all()
                ]
            }
            for cat in Category.objects.prefetch_related(
                'sub_types', 
                'sub_types__rules__level', 
                'sub_types__rules__result'
            ).all()
        }

        serializer = self.get_serializer(structure)
        return Response(serializer.data, status=status.HTTP_200_OK)


class StudentProfileSelfAPIView(StudentFilterMixin, GenericAPIView):
    """
    API-представление для просмотра своего профиля студента.
    
    Возвращает профиль текущего авторизованного студента.
    """

    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = StudentProfileSerializer
    pagination_class = None

    @extend_schema(
        operation_id="student_api_v1_profile_self",
        summary="Получить свой профиль студента",
        responses={200: StudentProfileSerializer}
    )
    def get(self, request):
        user = request.user
        
        student = getattr(user, 'student_profile', None)
        
        if not student:
            return Response({"message": "Профиль студента не найден. Для просмотра необходима учетная запись студента."}, status=status.HTTP_404_NOT_FOUND)
            
        is_own_profile = True

        response_data = self.get_student_full_profile(student, is_own_profile)

        return Response(response_data, status=status.HTTP_200_OK)


class StudentProfileAPIView(ScopePermissionMixin, StudentFilterMixin, GenericAPIView):
    """
    API-представление для просмотра профиля студента по ID.

    Предоставляет доступ к полной информации о студенте.
    Просмотр чужого профиля разрешён только сотрудникам и только в пределах их
    области видимости (кафедра/факультет/ректорат).
    """

    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = StudentProfileSerializer
    pagination_class = None

    @extend_schema(
        operation_id="student_api_v1_profile_by_id",
        summary="Получить профиль студента по ID",
        responses={200: StudentProfileSerializer}
    )
    def get(self, request, student_id):
        user = request.user

        # Запрос профиля по явно указанному student_id
        student = Student.objects.select_related(
            'user', 'faculty', 'group__specialty'
        ).filter(id=student_id).first()

        if not student:
            return Response({"message": "Студент не найден"}, status=status.HTTP_404_NOT_FOUND)

        # Проверка: является ли запрашивающий пользователем этого профиля
        is_own_profile = (student.user and user.id == student.user.id)

        if not is_own_profile and not self.check_student_scope(user, student):
            return Response({"message": "Доступ запрещён"}, status=status.HTTP_403_FORBIDDEN)

        response_data = self.get_student_full_profile(student, is_own_profile)

        return Response(response_data, status=status.HTTP_200_OK)

class AchievementUploadCreateAPIView(CreateAPIView):
    """
    Обрабатывает загрузку нового достижения студента и файлов в SeaweedFS.
    
    Принимает multipart/form-data. Файлы загружаются параллельно в S3, 
    а метаданные сохраняются в БД.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [SessionAuthentication]
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'upload'
    serializer_class = AchievementUploadSerializer
    pagination_class = None

    @extend_schema(
        request=AchievementUploadSerializer,
        responses={201: serializers.CharField()}
    )
    def create(self, request, *args, **kwargs):
        """
        Обрабатывает POST-запрос на создание нового достижения.

        Выполняет валидацию входных данных с помощью сериализатора.
        При успешной валидации — сохраняет объект Document и связанные файлы.
        Возвращает сообщение об успехе или ошибку.

        Параметры:
            request (Request): HTTP-запрос с данными формы и файлами.
            *args: Дополнительные позиционные аргументы.
            **kwargs: Дополнительные именованные аргументы.

        Возвращает:
            Response:
                - 201 Created: Если достижение и файлы успешно сохранены.
                - 400 Bad Request: Если данные не прошли валидацию.
                - 500 Internal Server Error: Если произошла ошибка при сохранении.

        Особенности:
            - Доступ разрешён только аутентифицированным пользователям.
            - Поддерживает загрузку файлов через MultiPartParser и FormParser.
            - После валидации вызывается perform_create, который запускает логику сохранения.
            - Ожидается, что сериализатор сам обрабатывает загрузку файлов во внешнее хранилище.
            - В текущей реализации есть избыточная проверка is_valid() после raise_exception=True —
              это избыточно и может быть упрощено.

        Примечание:
            Текст ошибки возвращается как serializer.errors[0] — это некорректно, так как errors — словарь.
            Правильнее было бы вернуть весь словарь errors целиком.
        """

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        return Response({"message": "Достижение успешно загружено"}, status=status.HTTP_201_CREATED)


class AchievementDetailAPIView(ScopePermissionMixin, APIView):
    """
    Редактирование и удаление достижения самим студентом-владельцем.

    - PATCH  — частичное обновление (только свои заявки со статусом 'pending' или
      'rejected'; подтверждённые редактировать нельзя). Отклонённая заявка после
      правок возвращается на повторное рассмотрение.
    - DELETE — удаление своей заявки со статусом 'pending' или 'rejected'
      (подтверждённую удалить нельзя — баллы уже начислены); файлы удаляются
      из хранилища.

    Владение проверяется на уровне запроса (`user=request.user`): для чужих заявок
    возвращается 404, чтобы не раскрывать факт их существования.
    """
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = None

    def get_object(self, request, pk):
        return get_object_or_404(
            Document.objects.select_related('status', 'category', 'user__student_profile'),
            pk=pk,
            user=request.user,
        )

    @extend_schema(
        request=AchievementUpdateSerializer,
        responses={200: DocumentSerializer},
    )
    def patch(self, request, pk):
        doc = self.get_object(request, pk)

        if doc.status.code == 'approved':
            return Response(
                {"detail": "Нельзя редактировать подтверждённое достижение."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = AchievementUpdateSerializer(instance=doc, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        doc = serializer.save()

        return Response(DocumentSerializer(doc).data, status=status.HTTP_200_OK)

    @extend_schema(responses={204: None})
    def delete(self, request, pk):
        doc = self.get_object(request, pk)

        # Подтверждённое достижение студент удалить не может
        if doc.status.code == 'approved':
            return Response(
                {"detail": "Нельзя удалить подтверждённое достижение."},
                status=status.HTTP_403_FORBIDDEN,
            )

        files = list(doc.files.all())

        doc.delete()

        # Чистим файлы в хранилище
        for document_file in files:
            try:
                document_file.file.delete(save=False)
            except Exception:
                logger.exception("Не удалось удалить файл достижения из хранилища")

        return Response(status=status.HTTP_204_NO_CONTENT)