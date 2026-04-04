
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import authentication_classes, permission_classes

from django.db import transaction
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.views.decorators.vary import vary_on_headers
from django.shortcuts import get_object_or_404
from django.http import StreamingHttpResponse

from .serializers import DocumentSerializer, StudentProfileSerializer, CategorySerializer
from .models import Document, Student, Level, AchievementResult, DocType, Category, AchievementType, DocumentStatus, DocumentFile
from .scoring import get_cached_metadata, get_scoring_structure, calculate_achievement_score


from rest_framework.views import APIView, PermissionDenied
from rest_framework.generics import GenericAPIView, ListAPIView, CreateAPIView, RetrieveAPIView, DestroyAPIView
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .serializers import AchievementUploadSerializer

from urllib.parse import quote
import json, uuid,  requests


@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def get_student_radar_data(student):
    """Динамическое формирование данных радара из конфига"""
    categories = Category.objects.all()
    labels = []
    values = []
    
    for category in categories:
        labels.append(category.label)
        values.append(getattr(student, f"{category.code}_score", 0))
        
    return {"labels": labels, "data": values}

@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def get_student_full_profile(student, request, is_own_profile):
    """
    Возвращает данные профиля студента для отображения в интерфейсе.

    Формирует сериализованные данные профиля с учётом контекста запроса (владелец профиля или преподаватель),
    а также добавляет структуру данных для отображения радарной диаграммы активности студента.

    Параметры:
        user (User): Объект пользователя, чей профиль запрашивается.
            Ожидается, что у пользователя есть связанный профиль студента (user.student_profile).
        request (Request): Объект HTTP-запроса. Используется для передачи контекста сериализатору.
        is_own_profile (bool): Флаг, указывающий, запрашивает ли пользователь собственный профиль.
            Влияет на доступность и отображение некоторых полей в сериализаторе.

    Возвращает:
        dict: Словарь с данными профиля студента, включающий:
            - Основные поля из StudentProfileSerializer.
            - Дополнительное поле "radar_stats" с метками и значениями баллов по пяти направлениям:
                * Общественная - social_score
                * Учебная - academic_score
                * Спорт - sport_score
                * Творческая - cultural_score
                * Научная - research_score

    Особенности:
        - Доступ к функции разрешён только аутентифицированным пользователям (IsAuthenticated).
        - Используется сессионная аутентификация (SessionAuthentication).
    """
    serializer = StudentProfileSerializer(student, context={'request': request, 'is_own_profile': is_own_profile})
    data = serializer.data
    data["radar_stats"] = get_student_radar_data(student)
    
    if is_own_profile or request.user.groups.filter(name__in=['Department', 'Dean', 'Rectorate']).exists():
        data["email"] = student.user.email
        data["phone"] = getattr(student, 'phone', None)
        
    return data

@api_view(['GET'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
@cache_page(60 * 60 * 2)
def get_achievement_config(request) -> Response:    
    """
    Возвращает конфигурацию для формы добавления достижения.

    Предоставляет структурированные данные, необходимые фронтенду для построения
    динамической формы ввода информации о достижении студента.
    
    Включает иерархию категорий и подтипов, а также списки допустимых значений
    для уровней, результатов и типов документов.

    Параметры:
        request (Request): HTTP-запрос. Не требует параметров.

    Возвращает:
        Response: json-ответ с полями:
            - structure (dict): Иерархия категорий и подтипов с флагами needsLevel и needsResult.
            - levels (list): Список доступных уровней.
            - results (list): Список доступных результатов.
            - doc_types (list): Полный список типов документов (включая 'Другое').

    Пример ответа:
        {
            "structure": {
                "academic": {
                    "label": "Учебная",
                    "sub_types": [
                        {
                            "value": "grades",
                            "label": "Успеваемость",
                            "needsLevel": false,
                            "needsResult": true
                        },
                        ...
                    ]
                },
                ...
            "levels": [
                {
                    "value": "world",
                    "label": "Международный (Мир)"
                },
                ...
            ],
            "results": [
                {
                    "value": "1",
                    "label": "1 место / Победитель"
                },
                ...
            ],
            "doc_types": [
                {
                    "value": "diploma",
                    "label": "Диплом"
                },
                ...
        }

    Примечание:
        т.к они используются как заглушки в модели, но не предназначены для выбора пользователями.
    """

    levels = [item for item in get_cached_metadata(Level, 'meta_levels') if item['value'] != 'none']
    results = [item for item in get_cached_metadata(AchievementResult, 'meta_results') if item['value'] != 'none']
    
    data = {
        "structure": get_scoring_structure(),
        "levels": levels,
        "results": results,
        "doc_types": get_cached_metadata(DocType, 'meta_doc_types')
    }
    return Response(data, status=status.HTTP_200_OK)

class DocumentDownloadApiView(APIView):
    """
    API-представление для безопасного скачивания прикреплённых файлов документов.

    Проксирует запрос к хранилищу, проверяя права пользователя
    и ограничивая размер скачиваемого файла.
    
    Предотвращает прямой доступ к URL-адресам файлов.
    """
    
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get(self, request, file_id):
        """
        Обрабатывает GET-запрос на скачивание файла по его ID.

        Проверяет:
        - Существование файла.
        - Права пользователя на скачивание (владелец или персонал).
        - Размер файла (не более 20 МБ).

        При успехе проксирует содержимое файла от хранилища клиенту с корректным заголовком Content-Disposition.

        Параметры:
            request (Request): Объект HTTP-запроса с аутентифицированным пользователем.
            file_id (int): Идентификатор объекта DocumentFile.

        Возвращает:
            StreamingHttpResponse: Потоковый ответ с содержимым файла.
            Или JSON-ошибку при:
                - 403 Forbidden - нет прав.
                - 400 Bad Request - файл слишком большой.
                - 503 Service Unavailable - ошибка подключения к хранилищу.

        Логика:
            - Получает объект DocumentFile по ID.
            - Проверяет доступ через метод can_download.
            - Ограничивает размер файла 20 МБ.
            - Выполняет потоковый запрос к AWS S3.
            - Передаёт содержимое клиенту с сохранением оригинального имени файла.

        Особенности:
            - Использует StreamingHttpResponse для эффективной передачи больших файлов без загрузки в память.
            - Имя файла кодируется в UTF-8 с помощью quote для корректного отображения кириллицы.
            - Таймаут запроса к AWS - 5 секунд.
        """
        
        file_obj = get_object_or_404(DocumentFile, id=file_id)
        
        if not self.can_download(request.user, file_obj):
            raise PermissionDenied("У вас нет прав на скачивание этого файла")
        
        if file_obj.file.size > 20 * 1024 * 1024:  # Ограничение на размер файла (20 МБ)
            return Response({"error": "Файл слишком большой"}, status=status.HTTP_400_BAD_REQUEST)
        
        aws_url = file_obj.file.url
        
        try:
            response = requests.get(aws_url, stream=True, timeout=5)
            response.raise_for_status()
            
            proxy_response = StreamingHttpResponse(
                response.iter_content(chunk_size=8192),
                content_type=response.headers.get('Content-Type', 'application/octet-stream')
            )
            
            filename = quote(file_obj.original_file_name)
            proxy_response['Content-Disposition'] = f"attachment; filename*=UTF-8''{filename}"
            
            return proxy_response
            
        except requests.exceptions.RequestException as e:
            print(f"AWS Proxy Error: {e}")
            return Response({"error": "AWS временно недоступен"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    
    def can_download(self, user, file_obj):
        return user.id == file_obj.document.user_id or user.is_staff

class AchievementUploadCreateAPIView(CreateAPIView):
    """
    Обрабатывает загрузку нового достижения студента и файлов в SeaweedFS.
    
    Принимает multipart/form-data. Файлы загружаются параллельно в S3, 
    а метаданные сохраняются в БД.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [SessionAuthentication]
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = AchievementUploadSerializer
    pagination_class = None
    
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