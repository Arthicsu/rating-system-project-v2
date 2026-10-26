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

from django.contrib.auth import authenticate, get_user_model, login, logout, update_session_auth_hash
from django.http import HttpResponse, StreamingHttpResponse
from django.utils.decorators import method_decorator
from django.utils.http import content_disposition_header
from django.views.decorators.cache import cache_page
from django.views.decorators.vary import vary_on_headers

from rest_framework import mixins, status, viewsets
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import action
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
from core.permissions import CanAccessDocumentFile, IsStaffProfile, IsStudent
from core.preview import (
    PreviewBusyError,
    PreviewConversionError,
    is_office_file,
    render_office_pdf,
)
from core.serializers import ErrorDetailSerializer, MessageSerializer
from core.throttling import LoginIpRateThrottle, LoginRateThrottle

from students.models import Category, DocumentFile
from students.serializers import (
    CategorySerializer,
    SemesterStudentListSerializer,
    StudentRatingSerializer,
)
from university_structure.models import AcademicYear, Faculty, Group
from university_structure.serializers import RatingFiltersResponseSerializer

from .serializers import (
    ChangePasswordSerializer,
    DocumentFileAccessSerializer,
    ForgotPasswordRequestSerializer,
    LoginRequestSerializer,
    NotificationSettingsSerializer,
    PendingCountSerializer,
    StudentRegistrationSerializer,
    UserResponseSerializer,
)
from .services import get_pending_docs_count, request_password, resolve_login_username
from .signals import _client_ip
from .tasks import send_password_changed_email

logger = logging.getLogger(__name__)
audit_logger = logging.getLogger('audit')

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
    Аутентификация: login / logout / session (ex check-auth) / forgot-password / change-password.

    Регистрация отключена намеренно (см. RegistrationAPIView — код сохранён,
    маршрут не подключён).
    """
    authentication_classes = [SessionAuthentication]

    def get_permissions(self):
        if self.action in ('login', 'session', 'forgot_password'):
            return [AllowAny()]
        if self.action in ('change_password', 'notifications'):
            # Сотрудникам смены пароля нет: их общими учётками управляет ОИ.
            return [IsStudent()]
        return [IsAuthenticated()]

    def get_throttles(self):
        if self.action == 'login':
            return [LoginRateThrottle(), LoginIpRateThrottle()]
        if self.action in ('forgot_password', 'change_password'):
            # change_password - по пользователю: подбор текущего пароля из чужой сессии упирается в лимит.
            self.throttle_scope = self.action
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
            # Почту студента принимаем без учёта регистра (см. resolve_login_username).
            username=resolve_login_username(serializer.validated_data['username']),
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
        responses={200: MessageSerializer},
    )
    @action(detail=False, methods=['post'], url_path='forgot-password')
    def forgot_password(self, request):
        """«Получить пароль» студентом: первый вход и «забыл пароль» (services.request_password)."""
        serializer = ForgotPasswordRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        # Ответ всегда один и тот же: по нему нельзя узнать, есть ли аккаунт с такой почтой.
        # В очередь уходит только id - пароль генерируется в воркере, через брокер не идёт.
        request_password(email)
        return Response({
            "message": f"Если студенческий аккаунт с почтой {email} существует, на неё отправлено письмо",
        })

    @extend_schema(
        request=ChangePasswordSerializer,
        responses={200: MessageSerializer},
    )
    @action(detail=False, methods=['post'], url_path='change-password')
    def change_password(self, request):
        """Смена пароля студентом: эта сессия остаётся, остальные гаснут (сменился хэш пароля)."""
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.save(update_fields=['password'])
        update_session_auth_hash(request, user)
        audit_logger.info("password changed user=%s ip=%s", user.pk, _client_ip(request))

        # Пароль уже сменён: сбой очереди писем не должен превращаться в 500.
        try:
            send_password_changed_email.delay(user.pk)
        except Exception:
            logger.exception("change password: cannot queue notice for user id=%s", user.pk)
        return Response({"message": "Пароль изменён"})

    @extend_schema(request=NotificationSettingsSerializer, responses={200: NotificationSettingsSerializer})
    @action(detail=False, methods=['put'], url_path='notifications')
    def notifications(self, request):
        """Письма студенту о решениях по его заявкам: включить или выключить."""
        serializer = NotificationSettingsSerializer(request.user, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


_RATING_PARAMS = [
    OpenApiParameter('category', OpenApiTypes.STR,
                     description="Категория сортировки: common (по умолчанию) | academic | research | sport | social | cultural"),
    OpenApiParameter('direction', OpenApiTypes.STR,
                     description="Направление сортировки: desc (по умолчанию) | asc"),
    OpenApiParameter('academic_year', OpenApiTypes.INT, description='ID семестра (по умолчанию — текущий)'),
    OpenApiParameter('semester', OpenApiTypes.INT, description='Синоним academic_year'),
]


@extend_schema(tags=['rating'])
class RatingViewSet(mixins.ListModelMixin, GenericViewSet):
    """
    Рейтинг студентов за выбранный семестр (по умолчанию текущий). Доступ
    только сотрудникам: ФИО и баллы всех студентов - не для любого
    авторизованного.

    - list — пагинированный рейтинг с фильтрами, выбором семестра и
      сортировкой по категории/направлению;
    - filters — данные для построения фильтров (кэш 2 часа);
    - export — выгрузка рейтинга в Excel (те же параметры, что и list).
    """
    authentication_classes = [SessionAuthentication]
    # list ограничен scope сотрудника (rating_queryset), поэтому его cache_page
    # разделён по Cookie (vary_on_headers): у каждой сессии свой ключ кэша.
    # filters - общий справочник факультетов/курсов/групп, кэш один на всех.
    # Permissions отрабатывают в dispatch до cache_page; при изменении баллов
    # кэш списка сбрасывается (см. services.apply_score_delta).
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

    def get_serializer_class(self):
        if getattr(self, 'swagger_fake_view', False):
            return StudentRatingSerializer

        # Прошлый семестр — баллы из аннотаций sem_* (история SemesterScore).
        _, is_past = querysets.get_requested_semester(self.request)
        return SemesterStudentListSerializer if is_past else StudentRatingSerializer

    @extend_schema(
        parameters=_RATING_PARAMS,
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

    @extend_schema(summary="Экспорт рейтинга в Excel", parameters=_RATING_PARAMS,
                   responses={200: OpenApiTypes.BINARY})
    @action(detail=False, methods=['get'])
    def export(self, request):
        # Выгружается ровно тот срез, что виден в таблице: семестр, фильтры,
        # категория и направление сортировки берутся из тех же параметров.
        semester_id, is_past = querysets.get_requested_semester(request)
        semester = AcademicYear.objects.filter(pk=semester_id).first() if semester_id else None

        queryset = self.filter_queryset(self.get_queryset())
        excel_bytes = generate_rating_excel(
            queryset,
            score_prefix='sem_' if is_past else '',
            semester_label=semester.label if semester else '',
        )

        filename = f"student_rating_{semester.label}.xlsx" if semester else "student_rating.xlsx"
        response = HttpResponse(
            excel_bytes,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        # content_disposition_header кодирует кириллицу метки семестра в filename*.
        response['Content-Disposition'] = content_disposition_header(True, filename)
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
