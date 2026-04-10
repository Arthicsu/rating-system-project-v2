from drf_spectacular.utils import extend_schema, OpenApiExample, OpenApiParameter, inline_serializer
from drf_spectacular.types import OpenApiTypes

from django.contrib.auth import login, logout, authenticate
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.db.models import Avg, F, Count, Q, ExpressionWrapper, IntegerField
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.views.decorators.vary import vary_on_headers

from rest_framework.views import APIView
from rest_framework.generics import GenericAPIView, ListAPIView, CreateAPIView, RetrieveAPIView, DestroyAPIView
from rest_framework.response import Response
from rest_framework import status, serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authentication import SessionAuthentication

from students.views import get_student_full_profile
from university_structure.models import Faculty, Group
from students.models import Document, Student, Category
from .serializers import StudentRegistrationSerializer, AuthUserResponseSerializer, LoginRequestSerializer
from students.serializers import DocumentSerializer, PendingDocumentSerializer, StudentProfileSerializer, StudentRatingSerializer, CategorySerializer
from university_structure.serializers import FacultySerializer, DepartmentSerializer, SpecialtySerializer, GroupSerializer, StaffSerializer, RatingFiltersResponseSerializer
from core.pagination import StandardResultsSetPagination
from core.students_query_set_mixin import StudentWithAccessMixin, StudentRatingQuerySetMixin

User = get_user_model()
pagination_class = StandardResultsSetPagination

def get_response_data_for_user(user):
    """
    Вспомогательная функция для формирования ответа с данными пользователя
    при логине, регистрации и проверке авторизации.
    """
    record_book = None
    if hasattr(user, 'student_profile'):
        record_book = user.student_profile.record_book

    roles = list(user.groups.values_list('name', flat=True))
    pending_docs_count = 0

    if hasattr(user, 'staff_profile'):
        staff = user.staff_profile

        if getattr(user, 'is_rectorate', False):
            pending_docs_count = Document.objects.filter(status__code='approved').count()
            
        elif getattr(user, 'is_dean', False) and staff.faculty:
            pending_docs_count = Document.objects.filter(
                user__student_profile__faculty=staff.faculty,
                status__code='approved'
            ).count()
            
        elif getattr(user, 'is_dept_staff', False) and staff.department:
            pending_docs_count = Document.objects.filter(
                user__student_profile__group__specialty__department=staff.department,
                status__code='pending'
            ).count()

    return {
        "user_id": user.id,
        "username": getattr(user, 'username', ''),
        "record_book": record_book,
        "isAuthenticated": True,
        "isStaff": user.is_staff,
        "full_name": user.get_user_display_name(),
        "roles": roles,
        "pending_docs_count": pending_docs_count,
    }

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
    serializer_class = StudentRegistrationSerializer 

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

        Пример успешного ответа:
            {
                "user_id": 123,
                "username": "student1@ya.ru",
                "record_book": 24-01.01,
                "isAuthenticated": true,
                "isStaff": true,
                "full_name": "Мат",
                "roles": [
                    "Student"
                ],
                "pending_docs_count": 0,
                "message": "Регистрация успешна"
            }

        Пример ошибки:
            {
                "username": ["Пользователь с таким логином уже существует."],
                "record_book": ["Студент с таким номером зачётки уже зарегистрирован."]
            }

        Особенности:
            - Доступ разрешён всем (AllowAny), включая неаутентифицированных пользователей.
            - После регистрации пользователь сразу входит в систему (функция login).
        """

        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        login(request, user)
        
        raw_data = get_response_data_for_user(user)
        raw_data["message"] = "Регистрация успешна"
        
        response_serializer = AuthUserResponseSerializer(raw_data)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

class LoginAPIView(GenericAPIView):
    permission_classes = [AllowAny]
    authentication_classes = [SessionAuthentication]
    serializer_class = LoginRequestSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        username = serializer.validated_data.get('username')
        password = serializer.validated_data.get('password')
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            login(request, user)
            
            response_data = get_response_data_for_user(user)
            response_data["message"] = "Успешный вход"

            return Response(response_data, status=status.HTTP_200_OK)
        else:
            return Response({"detail": "Неверный логин или пароль"}, status=status.HTTP_401_UNAUTHORIZED)
        
class CheckAuthAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [SessionAuthentication]
    def get(self, request):
        if request.user.is_authenticated:
            response_data = get_response_data_for_user(request.user)    
            return Response(response_data, status=status.HTTP_200_OK)
        
        return Response({"isAuthenticated": False}, status=status.HTTP_401_UNAUTHORIZED)

class LogoutAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [SessionAuthentication]
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

    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

@method_decorator(cache_page(60 * 15), name='dispatch')
@method_decorator(vary_on_headers('Cookie'), name='dispatch')
class RatingListAPIView(StudentRatingQuerySetMixin, ListAPIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [SessionAuthentication]
    serializer_class = StudentRatingSerializer
        
    def get_queryset(self):
        return self.get_base_rating_queryset()

class ProfileAPIView(StudentWithAccessMixin, APIView):
    """
    API-представление для получения профиля текущего пользователя.

    Используется для получения полных данных о собственном профиле - студента или сотрудника вуза.
    
    В зависимости от роли пользователя возвращает соответствующий набор информации:
        - Для студента: личные данные, баллы, документы, статистику активности.
        - Для сотрудника (кафедра, проректор, декан): статистику по подведомственным студентам, 
        список ожидающих модерации документов и списки студентов с ограниченным объёмом данных.
    """
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(operation_id="get_my_profile")
    def get(self, request):
        """
        Обрабатывает GET-запрос на получение профиля текущего пользователя.

        Формирует детализированный ответ в зависимости от роли:
        - Студент: возвращает свои данные, баллы, документы и radar-статистику.
        - Сотрудник: возвращает статистику, список студентов и ожидающих документов
          в рамках своей зоны доступа (вуз, факультет, кафедра).

        Параметры:
            request (Request): Объект HTTP-запроса с аутентифицированным пользователем.

        Возвращает:
            Response: JSON-ответ с полями, зависящими от типа пользователя:
                - Общие поля: id, full_name, email, роли, is_own_profile.
                - Для студента: record_book, group, баллы, documents, radar_stats, type='student'.
                - Для сотрудника: faculty, scope, department, stats, students_list, pending_documents,
                  managed_groups, type='staff'.

        Особенности:
            - Для сотрудников применяется фильтрация студентов по иерархии: ректорат → деканат → кафедра.
            - Список студентов ограничен 200 записями для производительности.
        """


        user = request.user

        response_data = {
            "id": user.id,
            "full_name": user.get_full_username(),
            "email": user.email,
            "roles": list(user.groups.values_list('name', flat=True)),
            "is_own_profile": True,
            "isStaff": user.is_staff,
        }

        # Студент
        if user.is_student:
            student = getattr(user, 'student_profile', None)
            if student:
                student_data = get_student_full_profile(student, request, is_own_profile=True)
                response_data.update(student_data)
                response_data["type"] = "student"

        # Сотрудник (Ректорат / Декан / Кафедра)
        elif hasattr(user, 'staff_profile'):
            staff = user.staff_profile
            response_data["type"] = "staff"
            response_data["department"] = staff.department.name if staff.department else "Не указан"
            response_data["faculty"] = staff.faculty.name if staff.faculty else "Не указан"
            
        return Response(response_data)

@method_decorator(cache_page(60), name='dispatch')
class PublicProfileAPIView(APIView):
    """
    API-представление для просмотра профиля студента.

    Предоставляет доступ к полной информации о студенте. Просмотр чужого профиля
    разрешён только пользователям с правами персонала (например, из отдела, деканата или ректората).
    Обычные студенты могут просматривать только свой собственный профиль.
    """
    permission_classes = [IsAuthenticated]
    @extend_schema(operation_id="get_public_profile")
    def get(self, request, student_id):
        """
        Обрабатывает GET-запрос на получение данных профиля студента по его ID.

        Проверяет, имеет ли текущий пользователь право на просмотр профиля:
        - Владелец профиля (свой профиль) — всегда может просматривать.
        - Сотрудники (группы 'Department', 'Dean', 'Rectorate') — имеют расширенный доступ.
        - Другие студенты — получают отказ.

        Параметры:
            request (Request): Объект HTTP-запроса с аутентифицированным пользователем.
            student_id (int): Идентификатор студента, чей профиль запрашивается.

        Возвращает:
            Response:
                - 200 OK: Если доступ разрешён. В теле — данные профиля, возвращаемые get_student_full_profile.
                - 403 Forbidden: Если у пользователя нет прав на просмотр профиля.
                - 404 Not Found: Если студент с указанным ID не существует.

        Логика:
            - Определяется, является ли пользователь сотрудником через проверку групп.
            - Проверяется, принадлежит ли профиль текущему пользователю.
            - При отсутствии прав возвращается ошибка 403.
            - При успехе — вызывается функция формирования полного профиля.

        Примечание:
            - Используется централизованная функция get_student_full_profile для формирования ответа.
            - Права доступа управляются через группы Django
        """        

        is_staff = hasattr(request.user, 'staff_profile')
        
        target_student = get_object_or_404(Student, id=student_id)
        
        is_own_profile = (request.user.id == target_student.user.id)

        if not is_own_profile and not is_staff:
            return Response({"detail": "У вас нет прав для просмотра этого профиля."}, status=status.HTTP_403_FORBIDDEN)

        response_data = get_student_full_profile(target_student, request, is_own_profile)
        return Response(response_data)