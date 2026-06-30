from drf_spectacular.utils import extend_schema, OpenApiExample, OpenApiParameter, inline_serializer
from drf_spectacular.types import OpenApiTypes

from django.contrib.auth import login, logout, authenticate
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.db.models import Avg, F, Count, Q, ExpressionWrapper, IntegerField
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.views.decorators.vary import vary_on_headers
from django.views.decorators.csrf import ensure_csrf_cookie
from django.middleware.csrf import get_token
from django.http import StreamingHttpResponse

from rest_framework.views import APIView, PermissionDenied
from rest_framework.generics import GenericAPIView, ListAPIView, CreateAPIView, RetrieveAPIView, DestroyAPIView
from rest_framework.response import Response
from rest_framework import status, serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authentication import SessionAuthentication
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.exceptions import APIException

from core.throttling import LoginRateThrottle
from university_structure.models import Faculty, Group
from students.models import Category, DocumentFile
from .serializers import StudentRegistrationSerializer, LoginRequestSerializer, UserResponseSerializer, DocumentFileAccessSerializer
from students.serializers import DocumentSerializer, PendingDocumentSerializer, StudentProfileSerializer, StudentRatingSerializer, CategorySerializer
from university_structure.serializers import FacultySerializer, DepartmentSerializer, SpecialtySerializer, GroupSerializer, StaffSerializer, RatingFiltersResponseSerializer
from core.pagination import StandardResultsSetPagination
from core.students_query_set_mixin import StudentWithAccessMixin, StudentRatingQuerySetMixin
from core.scope_permission_mixin import ScopePermissionMixin
from core.preview import (
    is_office_file,
    render_office_pdf,
    PreviewBusyError,
    PreviewConversionError,
)

from urllib.parse import quote
import logging, re, mimetypes, requests

logger = logging.getLogger(__name__)

User = get_user_model()
pagination_class = StandardResultsSetPagination


class RegistrationAPIView(CreateAPIView):
    """
    API-представление для регистрации нового студента.

    Позволяет анонимным пользователям зарегистрироваться в системе через передачу данных,
    таких как ФИО, номер зачётной книжки, логин, пароль и другие необходимые поля.
    После успешной валидации создаёт пользователя и связанный профиль студента,
    автоматически выполняет вход и возвращает базовую информацию о пользователе.
    """
    
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'register'
    serializer_class = StudentRegistrationSerializer

    @extend_schema(
        request=StudentRegistrationSerializer,
        responses={201: UserResponseSerializer}
    )
    def post(self, request):
        """
        Обрабатывает POST-запрос на регистрацию нового студента.

        Использует StudentRegistrationSerializer для валидации входных данных и создания пользователя.
        При успешной регистрации:
        - Сохраняет пользователя и профиль студента.
        - Автоматически авторизует пользователя в текущей сессии (login).
        - Возвращает JSON-ответ с информацией о новом пользователе.

        Параметры:
            request (Request): HTTP-запрос с данными пользователя в формате JSON.

        Возвращает:
            Response:
                - 201 Created: Если данные валидны и регистрация прошла успешно.
                    В теле - сообщение и данные пользователя.
                - 400 Bad Request: Если данные некорректны. В теле - ошибки валидации.

        Особенности:
            - Доступ разрешён всем (AllowAny), включая неаутентифицированных пользователей.
            - После регистрации пользователь сразу входит в систему (функция login).
        """

        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        login(request, user)
        
        response_serializer = UserResponseSerializer(user)
        response_data = response_serializer.data
        response_data["message"] = "Регистрация успешна"
        
        return Response(response_data, status=status.HTTP_201_CREATED)

class LoginAPIView(GenericAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [LoginRateThrottle]
    serializer_class = LoginRequestSerializer

    @extend_schema(
        request=LoginRequestSerializer,
        responses={200: UserResponseSerializer}
    )
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        username = serializer.validated_data.get('username')
        password = serializer.validated_data.get('password')
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            login(request, user)
            
            response_serializer = UserResponseSerializer(user)
            response_data = response_serializer.data
            response_data["message"] = "Успешный вход"

            return Response(response_data, status=status.HTTP_200_OK)
        else:
            return Response({"message": "Неверный логин или пароль"}, status=status.HTTP_401_UNAUTHORIZED)

# @method_decorator(ensure_csrf_cookie, name='dispatch')
class CheckAuthAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [SessionAuthentication]
    serializer_class = UserResponseSerializer

    @extend_schema(
        responses={
            200: UserResponseSerializer,
        }
    )
    def get(self, request):
        if request.user.is_authenticated:
            response_data = UserResponseSerializer(request.user).data
            return Response(response_data, status=status.HTTP_200_OK)

        return Response({"isAuthenticated": False}, status=status.HTTP_200_OK)

# @method_decorator(ensure_csrf_cookie, name='dispatch')
# class CsrfTokenAPIView(APIView):
#     permission_classes = [AllowAny]
#     authentication_classes = []

#     @extend_schema(
#         responses={200: inline_serializer(name='CsrfTokenResponse', fields={'csrfToken': serializers.CharField()})}
#     )
#     def get(self, request):
#         csrf_token = get_token(request)
#         response = Response({"csrfToken": csrf_token}, status=status.HTTP_200_OK)
#         response['X-CSRFToken'] = csrf_token
#         return response

class LogoutAPIView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [SessionAuthentication]
    serializer_class = UserResponseSerializer

    @extend_schema(
        methods=["POST"],
        responses={200: None}
    )
    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_200_OK)

@method_decorator(cache_page(60 * 60 * 2), name='dispatch')
class RatingFiltersAPIView(GenericAPIView):
    """
    Данные для фильтров рейтинга.
    Возвращает списки факультетов, курсов и групп для построения фильтров на клиенте.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [SessionAuthentication]
    serializer_class = RatingFiltersResponseSerializer
    
    @extend_schema(
        responses={200: RatingFiltersResponseSerializer()}
    )
    def get(self, request):
        faculties = Faculty.objects.values('id', 'short_name', 'name')
        courses = Group.objects.values_list('course', flat=True).distinct().order_by('course')
        groups = Group.objects.filter(students__isnull=False).select_related('specialty__faculty').distinct()
        
        serializer = RatingFiltersResponseSerializer({
            'faculties': faculties,
            'courses': courses,
            'groups': groups,
        })
        return Response(serializer.data, status=status.HTTP_200_OK)    

@method_decorator(cache_page(60 * 60 * 2), name='dispatch')  
class CategoryAchievementAPIView(ListAPIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [SessionAuthentication]
    serializer_class = CategorySerializer
    queryset = Category.objects.all()
    pagination_class = None

    @extend_schema(
        responses={200: CategorySerializer(many=True)}
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

@method_decorator(cache_page(60 * 5), name='dispatch')
@method_decorator(vary_on_headers('Cookie'), name='dispatch')
class RatingListAPIView(StudentRatingQuerySetMixin, ListAPIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [SessionAuthentication]
    serializer_class = StudentRatingSerializer

    @extend_schema(
        responses={200: StudentRatingSerializer(many=True)}
    )
    def get_queryset(self):
        return self.get_base_rating_queryset()


class FileTooLargeError(APIException):
    """Файл превышает допустимый размер для отдачи клиенту (HTTP 400)."""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = {"error": "Файл слишком большой"}
    default_code = "file_too_large"


class BaseDocumentFileAccessView(ScopePermissionMixin, GenericAPIView):
    """
    Базовый класс для эндпоинтов, отдающих файл документа (скачивание/предпросмотр).

    Инкапсулирует общую для них логику: выборку `DocumentFile` с нужными
    `select_related`, проверку прав доступа в области видимости пользователя и
    ограничение размера файла. Наследникам остаётся реализовать только сам способ
    отдачи файла в `get()` (проксирование на скачивание или inline-предпросмотр).
    """

    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = DocumentFileAccessSerializer
    queryset = DocumentFile.objects.select_related(
        'document__user__student_profile__faculty',
        'document__user__student_profile__group__specialty',
    )
    lookup_field = 'id'
    lookup_url_kwarg = 'file_id'
    pagination_class = None

    # Ограничение на размер файла, отдаваемого клиенту (20 МБ).
    max_file_size = 20 * 1024 * 1024
    # Сообщение об отказе в доступе — уточняется в наследниках.
    access_denied_message = "У вас нет прав на доступ к этому файлу"

    def get_accessible_file(self):
        """
        Возвращает `DocumentFile` по `file_id` из URL, проверив права и размер.

        Поднимает:
            - Http404 — файл не найден;
            - PermissionDenied (403) — нет доступа в области видимости пользователя;
            - FileTooLargeError (400) — файл превышает `max_file_size`.
        """
        file_obj = self.get_object()

        if not self.can_access_document_file(self.request.user, file_obj):
            raise PermissionDenied(self.access_denied_message)

        if file_obj.file.size > self.max_file_size:
            raise FileTooLargeError()

        return file_obj


class DocumentDownloadApiView(BaseDocumentFileAccessView):
    """
    API-представление для безопасного скачивания прикреплённых файлов документов.

    Проксирует запрос к хранилищу (`Content-Disposition: attachment`), проверяя
    права пользователя и ограничивая размер скачиваемого файла. Предотвращает
    прямой доступ к URL-адресам файлов в хранилище.
    """

    access_denied_message = "У вас нет прав на скачивание этого файла"

    @extend_schema(
        summary="Скачать файл документа",
        responses={200: OpenApiTypes.BINARY},
    )
    def get(self, request, file_id):
        """
        Обрабатывает GET-запрос на скачивание файла по его ID.

        Получает объект через `get_accessible_file()` (существование + права +
        размер ≤ 20 МБ), затем потоково проксирует содержимое из хранилища клиенту
        с сохранением оригинального имени файла (UTF-8 в Content-Disposition).
        Таймаут запроса к хранилищу — 5 секунд.
        """
        file_obj = self.get_accessible_file()

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

        except requests.exceptions.RequestException:
            logger.exception("Ошибка проксирования файла из хранилища")
            return Response({"error": "Хранилище временно недоступено"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class DocumentPreviewApiView(BaseDocumentFileAccessView):
    """
    API-представление для предпросмотра прикреплённых файлов.

    В отличие от скачивания, отдаёт содержимое с `Content-Disposition: inline`,
    чтобы клиент рендерил файл (в `<iframe>`/`<img>`), а не сохранял.

    Офисные документы (.doc/.docx) конвертируются в PDF на сервере (Gotenberg)
    и кэшируются; PDF и изображения отдаются как есть. Скачивание оригинала —
    по-прежнему через DocumentDownloadApiView.
    """

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'preview'
    access_denied_message = "У вас нет прав на просмотр этого файла"

    @extend_schema(
        summary="Предпросмотр файла документа (офисные форматы — в PDF)",
        responses={200: OpenApiTypes.BINARY},
    )
    def get(self, request, file_id):
        file_obj = self.get_accessible_file()

        if is_office_file(file_obj.original_file_name):
            return self._office_preview(file_obj)
        return self._passthrough_preview(file_obj)

    def _office_preview(self, file_obj):
        """Отдаёт PDF (из кэша или после конвертации) для офисного документа."""
        try:
            pdf_stream = render_office_pdf(file_obj)
        except PreviewBusyError:
            response = Response(
                {"error": "Сервис предпросмотра занят, повторите позже"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
            response['Retry-After'] = '5'
            return response
        except PreviewConversionError:
            return Response(
                {"error": "Не удалось сконвертировать документ для предпросмотра"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        pdf_name = re.sub(r'\.[^.]+$', '', file_obj.original_file_name) + '.pdf'
        return self._inline_stream(pdf_stream, 'application/pdf', pdf_name)

    def _passthrough_preview(self, file_obj):
        """PDF и изображения отдаём как есть, но inline (для рендера на клиенте)."""
        content_type = mimetypes.guess_type(file_obj.original_file_name)[0] or 'application/octet-stream'
        try:
            stream = file_obj.file.open('rb')
        except Exception:
            logger.exception("Ошибка чтения файла из хранилища для предпросмотра")
            return Response(
                {"error": "Хранилище временно недоступно"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return self._inline_stream(stream, content_type, file_obj.original_file_name)

    def _inline_stream(self, file_like, content_type, filename):
        response = StreamingHttpResponse(self._iter_file(file_like), content_type=content_type)
        encoded = quote(filename)
        response['Content-Disposition'] = f"inline; filename*=UTF-8''{encoded}"
        return response

    @staticmethod
    def _iter_file(file_like, chunk_size=8192):
        try:
            while True:
                chunk = file_like.read(chunk_size)
                if not chunk:
                    break
                yield chunk
        finally:
            file_like.close()