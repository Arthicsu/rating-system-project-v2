from typing_extensions import ReadOnly

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

from rest_framework.views import APIView
from rest_framework.generics import GenericAPIView, ListAPIView, CreateAPIView, RetrieveAPIView, DestroyAPIView
from rest_framework.response import Response
from rest_framework import status, serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authentication import SessionAuthentication
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.parsers import JSONParser

from core.throttling import LoginRateThrottle
from university_structure.models import Faculty, Group
from students.models import Category
from .serializers import StudentRegistrationSerializer, LoginRequestSerializer, UserResponseSerializer, ForgotPasswordRequestSerializer
from students.serializers import DocumentSerializer, PendingDocumentSerializer, StudentProfileSerializer, StudentRatingSerializer, SemesterRatingSerializer, CategorySerializer
from university_structure.serializers import FacultySerializer, DepartmentSerializer, SpecialtySerializer, GroupSerializer, StaffSerializer, RatingFiltersResponseSerializer
from core.pagination import StandardResultsSetPagination
from core.students_query_set_mixin import StudentWithAccessMixin, StudentRatingQuerySetMixin
from .services import reset_user_password
from .tasks import send_recovery_password_email

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

    def get_serializer_class(self):
        # Прошлый семестр отдаём из истории (SemesterScore) тем же форматом, что и текущий.
        if self.get_requested_past_semester_id():
            return SemesterRatingSerializer
        return StudentRatingSerializer

    @extend_schema(
        responses={200: StudentRatingSerializer(many=True)}
    )
    def get_queryset(self):
        return self.get_base_rating_queryset()

class ForgotPasswordAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    parser_classes = [JSONParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'forgot_password'

    @extend_schema(
        request=ForgotPasswordRequestSerializer,
        responses={200: {"message": "Пароль успешно отправлен"}}
    )
    def post(self, request):
        serializer = ForgotPasswordRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data.get('email')

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response({"message": f"Если аккаунт с почтой {email} существует, на него отправлен новый пароль"},status=status.HTTP_200_OK,)

        try:
            if hasattr(user, 'get_user_display_name'):
                user_name = user.get_user_display_name()
            else:
                user_name = f"{user.last_name} {user.first_name}".strip() or "Пользователь"
        except Exception as e:
            # Если внутри get_user_display_name что-то упало (например, нет данных в staff_profile)
            # мы просто логируем это и используем дефолтное имя, чтобы не было 500 ошибки
            print(f"Logging Name Error: {e}") 
            user_name = "Пользователь"         
        # Отправка письма
        try:
            new_password = reset_user_password(user)
            send_recovery_password_email.delay(user.email, user_name, new_password)
            return Response(
                {"message": f"Если аккаунт с почтой {email} существует, на него отправлен новый пароль"}, 
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {"error": f"Ошибка сервера при отправке письма: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        return Response({"message": f"Если аккаунт с почтой {email} существует, на него отправлен новый пароль"},status=status.HTTP_200_OK,)