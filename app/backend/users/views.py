"""
ViewSets приложения users (API /api/v1/, router — backend/api_urls.py):
аутентификация, рейтинг для сотрудников, справочник категорий и выдача файлов.

RegistrationAPIView сохранён без маршрута — саморегистрация отключена намеренно.
"""
import logging
import mimetypes
import re
from urllib.parse import quote

import requests

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.http import HttpResponse, StreamingHttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.views.decorators.vary import vary_on_headers

from rest_framework import mixins, status, viewsets
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import action
from rest_framework.exceptions import APIException
from rest_framework.filters import SearchFilter
from rest_framework.generics import CreateAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.viewsets import GenericViewSet

from django_filters.rest_framework import DjangoFilterBackend

from core import querysets
from core.exceptions import (
    FileTooLarge,
    InvalidCredentials,
    PreviewBusy,
    PreviewFailed,
    StorageUnavailable,
)
from core.export_rating_excel import generate_rating_excel
from core.filters import StudentFilterSet
from core.permissions import CanAccessDocumentFile, IsStaffProfile
from core.preview import (
    PreviewBusyError,
    PreviewConversionError,
    is_office_file,
    render_office_pdf,
)
from core.serializers import ErrorDetailSerializer, MessageSerializer
from core.throttling import LoginRateThrottle

from students.models import Category, DocumentFile
from students.serializers import CategorySerializer, StudentRatingSerializer
from university_structure.models import Faculty, Group
from university_structure.serializers import RatingFiltersResponseSerializer

from .serializers import (
    DocumentFileAccessSerializer,
    ForgotPasswordRequestSerializer,
    LoginRequestSerializer,
    PendingCountSerializer,
    StudentRegistrationSerializer,
    UserResponseSerializer,
)
from .services import get_pending_docs_count
from .tasks import send_recovery_password_email

logger = logging.getLogger(__name__)

User = get_user_model()


class RegistrationAPIView(CreateAPIView):
    """
    Регистрация нового студента.

    ОТКЛЮЧЕНА НАМЕРЕННО: маршрут не подключён (аккаунты создаются через
    админку/импорт). Код сохранён; для включения добавьте action `register`
    в AuthViewSet (POST /api/v1/auth/register/) с вызовом этого же
    StudentRegistrationSerializer и throttle-scope 'register'.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'register'
    serializer_class = StudentRegistrationSerializer

    @extend_schema(
        request=StudentRegistrationSerializer,
        responses={201: UserResponseSerializer},
    )
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        login(request, user)

        response_data = UserResponseSerializer(user).data
        response_data["message"] = "Регистрация успешна"
        return Response(response_data, status=status.HTTP_201_CREATED)


@extend_schema(tags=['auth'])
class AuthViewSet(viewsets.ViewSet):
    """
    Аутентификация: login / logout / session (ex check-auth) / forgot-password.

    Регистрация отключена намеренно (см. RegistrationAPIView — код сохранён,
    маршрут не подключён).
    """
    authentication_classes = [SessionAuthentication]

    def get_permissions(self):
        if self.action in ('login', 'session', 'forgot_password'):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_throttles(self):
        if self.action == 'login':
            return [LoginRateThrottle()]
        if self.action == 'forgot_password':
            self.throttle_scope = 'forgot_password'
            return [ScopedRateThrottle()]
        return []

    @extend_schema(
        request=LoginRequestSerializer,
        responses={200: UserResponseSerializer, 401: ErrorDetailSerializer},
    )
    @action(detail=False, methods=['post'])
    def login(self, request):
        serializer = LoginRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = authenticate(
            request,
            username=serializer.validated_data['username'],
            password=serializer.validated_data['password'],
        )
        if user is None:
            raise InvalidCredentials()

        login(request, user)

        response_data = UserResponseSerializer(user).data
        response_data["message"] = "Успешный вход"
        return Response(response_data)

    @extend_schema(request=None, responses={200: None})
    @action(detail=False, methods=['post'])
    def logout(self, request):
        logout(request)
        return Response(status=status.HTTP_200_OK)

    @extend_schema(responses={200: UserResponseSerializer})
    @action(detail=False, methods=['get'])
    def session(self, request):
        """Текущая сессия: данные пользователя либо {"isAuthenticated": false}."""
        if request.user.is_authenticated:
            return Response(UserResponseSerializer(request.user).data)
        return Response({"isAuthenticated": False})

    @extend_schema(
        request=ForgotPasswordRequestSerializer,
        responses={200: MessageSerializer, 500: ErrorDetailSerializer},
    )
    @action(detail=False, methods=['post'], url_path='forgot-password')
    def forgot_password(self, request):
        serializer = ForgotPasswordRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        # Ответ не раскрывает, существует ли аккаунт с такой почтой.
        neutral_message = f"Если аккаунт с почтой {email} существует, на него отправлен новый пароль"

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response({"message": neutral_message})

        try:
            # В очередь уходит только id: генерация пароля и отправка письма
            # выполняются внутри задачи, открытый пароль через брокер не гоняем.
            send_recovery_password_email.delay(user.pk)
        except Exception:
            # Деталь ошибки — только в лог: текст исключения может раскрывать внутренности (SMTP, хосты).
            logger.exception("Ошибка при постановке письма восстановления в очередь")
            raise APIException("Ошибка сервера при отправке письма")

        return Response({"message": neutral_message})


@extend_schema(tags=['rating'])
class RatingViewSet(mixins.ListModelMixin, GenericViewSet):
    """
    Рейтинг студентов, всегда текущий семестр. Доступ только сотрудникам:
    ФИО и баллы всех студентов - не для любого авторизованного.

    - list — пагинированный рейтинг с фильтрами и сортировкой по категории;
    - filters — данные для построения фильтров (кэш 2 часа);
    - export — выгрузка рейтинга в Excel.
    """
    authentication_classes = [SessionAuthentication]
    # Кэш list/filters остаётся общим: rating_queryset не зависит от пользователя
    # (scope тут нет), а permissions отрабатывают в dispatch до cache_page.
    permission_classes = [IsStaffProfile]
    serializer_class = StudentRatingSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_class = StudentFilterSet
    search_fields = ['full_name', 'record_book']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            from students.models import Student
            return Student.objects.none()
        return querysets.rating_queryset(self.request)

    @extend_schema(
        parameters=[
            OpenApiParameter('category', OpenApiTypes.STR,
                             description="Категория сортировки: common (по умолчанию) | academic | research | sport | social | cultural"),
        ],
        responses={200: StudentRatingSerializer(many=True)},
    )
    @method_decorator(cache_page(60 * 5, key_prefix='rating-list'))
    @method_decorator(vary_on_headers('Cookie'))
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(responses={200: RatingFiltersResponseSerializer})
    @method_decorator(cache_page(60 * 60 * 2, key_prefix='rating-filters'))
    @action(detail=False, methods=['get'])
    def filters(self, request):
        faculties = Faculty.objects.values('id', 'short_name', 'name')
        courses = Group.objects.values_list('course', flat=True).distinct().order_by('course')
        groups = Group.objects.filter(students__isnull=False).select_related('specialty__faculty').distinct()

        serializer = RatingFiltersResponseSerializer({
            'faculties': faculties,
            'courses': courses,
            'groups': groups,
        })
        return Response(serializer.data)

    @extend_schema(summary="Экспорт рейтинга в Excel", responses={200: OpenApiTypes.BINARY})
    @action(detail=False, methods=['get'])
    def export(self, request):
        # Экспорт всегда по текущему семестру (генератор ожидает объекты Student).
        queryset = self.filter_queryset(self.get_queryset())
        excel_bytes = generate_rating_excel(queryset)

        response = HttpResponse(
            excel_bytes,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = 'attachment; filename="student_rating.xlsx"'
        return response


@extend_schema(tags=['categories'])
class CategoryViewSet(mixins.ListModelMixin, GenericViewSet):
    """Справочник категорий достижений с подтипами (кэш 2 часа)."""
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = CategorySerializer
    # prefetch до result: get_allowed_results обходит правила каждого подтипа.
    queryset = Category.objects.prefetch_related('sub_types__rules__result')
    pagination_class = None

    @extend_schema(responses={200: CategorySerializer(many=True)})
    @method_decorator(cache_page(60 * 60 * 2, key_prefix='categories'))
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)


@extend_schema(tags=['document-files'])
class DocumentFileViewSet(GenericViewSet):
    """
    Файлы документов: скачивание и предпросмотр.

    Доступ — владелец файла или сотрудник в своей области видимости
    (CanAccessDocumentFile); файлы больше 20 МБ не отдаются.
    """
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated, CanAccessDocumentFile]
    serializer_class = DocumentFileAccessSerializer
    queryset = DocumentFile.objects.select_related(
        'document__user__student_profile__faculty',
        'document__user__student_profile__group__specialty',
    )
    pagination_class = None
    lookup_value_regex = r'\d+'

    # Ограничение на размер файла, отдаваемого клиенту (20 МБ).
    max_file_size = 20 * 1024 * 1024

    def get_throttles(self):
        if self.action == 'preview':
            self.throttle_scope = 'preview'
            return [ScopedRateThrottle()]
        return []

    def _get_accessible_file(self):
        """DocumentFile по pk с проверкой прав (403) и размера (400 FileTooLarge)."""
        file_obj = self.get_object()
        if file_obj.file.size > self.max_file_size:
            raise FileTooLarge()
        return file_obj

    @extend_schema(
        summary="Скачать файл документа",
        responses={200: OpenApiTypes.BINARY, 400: ErrorDetailSerializer, 503: ErrorDetailSerializer},
    )
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Потоковое проксирование файла из хранилища (Content-Disposition: attachment)."""
        file_obj = self._get_accessible_file()

        try:
            upstream = requests.get(file_obj.file.url, stream=True, timeout=5)
            upstream.raise_for_status()
        except requests.exceptions.RequestException:
            logger.exception("Ошибка проксирования файла из хранилища")
            raise StorageUnavailable()

        proxy_response = StreamingHttpResponse(
            upstream.iter_content(chunk_size=8192),
            content_type=upstream.headers.get('Content-Type', 'application/octet-stream'),
        )
        filename = quote(file_obj.original_file_name)
        proxy_response['Content-Disposition'] = f"attachment; filename*=UTF-8''{filename}"
        return proxy_response

    @extend_schema(
        summary="Предпросмотр файла документа (офисные форматы — в PDF)",
        responses={200: OpenApiTypes.BINARY, 400: ErrorDetailSerializer, 503: ErrorDetailSerializer},
    )
    @action(detail=True, methods=['get'])
    def preview(self, request, pk=None):
        """Отдаёт файл inline; .doc/.docx конвертируются в PDF (Gotenberg) с кэшем."""
        file_obj = self._get_accessible_file()

        if is_office_file(file_obj.original_file_name):
            return self._office_preview(file_obj)
        return self._passthrough_preview(file_obj)

    def _office_preview(self, file_obj):
        try:
            pdf_stream = render_office_pdf(file_obj)
        except PreviewBusyError:
            raise PreviewBusy()
        except PreviewConversionError:
            raise PreviewFailed()

        pdf_name = re.sub(r'\.[^.]+$', '', file_obj.original_file_name) + '.pdf'
        return self._inline_stream(pdf_stream, 'application/pdf', pdf_name)

    def _passthrough_preview(self, file_obj):
        content_type = mimetypes.guess_type(file_obj.original_file_name)[0] or 'application/octet-stream'
        try:
            stream = file_obj.file.open('rb')
        except Exception:
            logger.exception("Ошибка чтения файла из хранилища для предпросмотра")
            raise StorageUnavailable()
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


@extend_schema(tags=['notifications'])
class NotificationViewSet(viewsets.ViewSet):
    """Уведомления сотрудника (счётчик заявок, ожидающих действия)."""
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: PendingCountSerializer})
    @action(detail=False, methods=['get'], url_path='pending-count')
    def pending_count(self, request):
        """Число заявок, ожидающих действия текущего сотрудника (0 для не-сотрудников)."""
        count = get_pending_docs_count(request.user)
        return Response(PendingCountSerializer({'pending_docs_count': count}).data)
