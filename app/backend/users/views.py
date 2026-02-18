from drf_spectacular.utils import extend_schema, OpenApiExample, OpenApiParameter
from drf_spectacular.types import OpenApiTypes

from django.contrib.auth import login, logout, authenticate
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.db.models import Avg, F, Count

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authentication import SessionAuthentication


from students.views import get_student_full_profile
from university_structure.models import Faculty, Group
from students.models import Document, Student
from .serializers import StudentRegistrationSerializer
from students.serializers import DocumentSerializer, StudentProfileSerializer, StudentRatingSerializer

User = get_user_model()

class RegistrationAPIView(APIView):
    """
    API-представление для регистрации нового студента.

    Позволяет анонимным пользователям зарегистрироваться в системе через передачу данных,
    таких как ФИО, номер зачётной книжки, логин, пароль и другие необходимые поля.
    После успешной валидации создаёт пользователя и связанный профиль студента,
    автоматически выполняет вход и возвращает базовую информацию о пользователе.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
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
                "message": "Регистрация успешна",
                "user_id": 123,
                "record_book": "123456",
                "isAuthenticated": true,
                "full_name": "Иванов Иван Иванович"
            }

        Пример ошибки:
            {
                "username": ["Пользователь с таким логином уже существует."],
                "record_book": ["Студент с таким номером зачётки уже зарегистрирован."]
            }

        Особенности:
            - Доступ разрешён всем (AllowAny), включая неаутентифицированных пользователей.
            - После регистрации пользователь сразу входит в систему (функция login).
            - Поле full_name берётся из кастомного метода get_full_username() модели пользователя.
            - Если у пользователя есть профиль студента, в ответ включается его record_book.
        """
        serializer = StudentRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            
            login(request, user)
            
            record_book = None
            if hasattr(user, 'student_profile'):
                record_book = user.student_profile.record_book

            return Response({
                "message": "Регистрация успешна",
                "user_id": user.id,
                "record_book": record_book,
                "isAuthenticated": user.is_authenticated,
                "isStaff": user.is_staff,
                "full_name": user.get_full_username(),
            }, status=status.HTTP_201_CREATED)
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [SessionAuthentication]  
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            login(request, user)
            
            record_book = None
            if hasattr(user, 'student_profile'):
                record_book = user.student_profile.record_book

            return Response({
                "message": "Успешный вход",
                "user_id": user.id,
                "record_book": record_book,
                "isAuthenticated": user.is_authenticated,
                "isStaff": user.is_staff,
                "full_name": user.get_full_username(),
            }, status=status.HTTP_200_OK)
        else:
            return Response({"detail": "Неверный логин или пароль"}, status=status.HTTP_401_UNAUTHORIZED)

class CheckAuthAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [SessionAuthentication]
    def get(self, request):
        if request.user.is_authenticated:
            record_book = None
            if hasattr(request.user, 'student_profile'):
                record_book = request.user.student_profile.record_book
            
            return Response({
                "user_id": request.user.id,
                "username": request.user.username,
                "record_book": record_book,
                "isAuthenticated": True,
                "full_name": request.user.get_full_username()
            }, status=status.HTTP_200_OK)
        
        return Response({"isAuthenticated": False}, status=status.HTTP_401_UNAUTHORIZED)

class LogoutAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [SessionAuthentication]
    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_200_OK)

class GroupListView(APIView): 
    permission_classes = [AllowAny]
    authentication_classes = []
    def get(self, request):
        groups = Group.objects.all().values('id', 'name', 'course', 'faculty')
        return Response(list(groups))

class RatingAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    def get(self, request):
        students = Student.objects.select_related('group', 'faculty').all()
        serializer = StudentRatingSerializer(students, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class ProfileAPIView(APIView):
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
    @extend_schema(
            summary="Получение профиля пользователя",
            description="",
            responses={200: OpenApiTypes.OBJECT},
            examples=[
                OpenApiExample(
                    "Пример для студента",
                    value={
                        "id": 1,
                        "full_name": "Иванов Иван Иванович",
                        "email": "student1@ya.ru",
                        "roles": [
                            "Student"
                        ],
                        "is_own_profile": True,
                        "user_id": 5,
                        "phone": "+7(999)444-55-66",
                        "record_book": "23-01-5",
                        "group": "ИВТ-301",
                        "group_id": "1",
                        "course": 3,
                        "faculty": "ИЭИ",
                        "academic_score": 0,
                        "research_score": 0,
                        "sport_score": 0,
                        "social_score": 0,
                        "cultural_score": 0,
                        "total_score": 0,
                        "documents": [
                            {
                                "id": 1,
                                "category": "academic",
                                "category_display": "Учебная",
                                "sub_type": "olympiad",
                                "sub_type_display": "Олимпиада / Конкурс",
                                "level": "university",
                                "level_display": "Вузовский",
                                "result": "1",
                                "result_display": "1 место / Победитель",
                                "achievement": "Победитель олимпиады по математике",
                                "rejection_reason": None,
                                "score": 3,
                                "status": "pending",
                                "doc_type": "certificate_of_participation",
                                "doc_type_display": "Свидетельство об участии",
                                "file_url": "https://wzmtxnmpqenmirlgdouy.supabase.co/storage/v1/object/public/achievement/23-01-5/4d4a5262-cdf2-472f-9b32-955150f4f179.pdf",
                                "original_file_name": "diplom2026.pdf",
                                "uploaded_at": "2026-02-18T15:37:42.544718Z"
                            }
                        ],
                        "radar_stats": {
                            "labels": [
                                "Учебная",
                                "Научно-исследовательская",
                                "Культурно-творческая",
                                "Спортивная",
                                "Общественная"
                            ],
                            "data": [
                                0,
                                0,
                                0,
                                0,
                                0
                            ]
                        },
                        "type": "student"
                    },
                    response_only=True,
                ),
                OpenApiExample(
                    "Пример для кафедры",
                    value={
                        "id": 3,
                        "full_name": "Носов Дмитрий Александрович",
                        "email": "nosov@ya.ru",
                        "roles": [
                            "Department"
                        ],
                        "is_own_profile": True,
                        "type": "staff",
                        "faculty": "Инженерно-экономический институт",
                        "scope": "department",
                        "department": "Информационные технологии",
                        "stats": {
                            "total_students": 11,
                            "avg_score": 0
                        },
                        "students_list": [
                            {
                                "id": 1,
                                "user_id": 5,
                                "full_name": "Иванов Иван Иванович",
                                "phone": "+7(999)444-55-66",
                                "record_book": "23-01-5",
                                "group": "ИВТ-301",
                                "group_id": "1",
                                "course": 3,
                                "faculty": "ИЭИ",
                                "academic_score": 0,
                                "research_score": 0,
                                "sport_score": 0,
                                "social_score": 0,
                                "cultural_score": 0,
                                "total_score": 0,
                                "documents": [
                                    {
                                        "id": 1,
                                        "category": "academic",
                                        "category_display": "Учебная",
                                        "sub_type": "olympiad",
                                        "sub_type_display": "Олимпиада / Конкурс",
                                        "level": "university",
                                        "level_display": "Вузовский",
                                        "result": "1",
                                        "result_display": "1 место / Победитель",
                                        "achievement": "Победитель олимпиады по математике",
                                        "rejection_reason": None,
                                        "score": 3,
                                        "status": "pending",
                                        "doc_type": "certificate_of_participation",
                                        "doc_type_display": "Свидетельство об участии",
                                        "file_url": "https://wzmtxnmpqenmirlgdouy.supabase.co/storage/v1/object/public/achievement/23-01-5/4d4a5262-cdf2-472f-9b32-955150f4f179.pdf",
                                        "original_file_name": "diplom2026.pdf",
                                        "uploaded_at": "2026-02-18T15:37:42.544718Z"
                                    }
                                ]
                            }],
                            "pending_documents": [
                                {
                                    "id": 1,
                                    "category": "academic",
                                    "category_display": "Учебная",
                                    "sub_type": "olympiad",
                                    "sub_type_display": "Олимпиада / Конкурс",
                                    "level": "university",
                                    "level_display": "Вузовский",
                                    "result": "1",
                                    "result_display": "1 место / Победитель",
                                    "achievement": "Победитель олимпиады по математике",
                                    "rejection_reason": None,
                                    "score": 3,
                                    "status": "pending",
                                    "doc_type": "certificate_of_participation",
                                    "doc_type_display": "Свидетельство об участии",
                                    "file_url": "https://wzmtxnmpqenmirlgdouy.supabase.co/storage/v1/object/public/achievement/23-01-5/4d4a5262-cdf2-472f-9b32-955150f4f179.pdf",
                                    "original_file_name": "diplom2026.pdf",
                                    "uploaded_at": "2026-02-18T15:37:42.544718Z",
                                    "student_id": 1,
                                    "student_name": "Иванов Иван Иванович",
                                    "group_id": 1,
                                    "record_book": "23-01-5"
                                }
                            ],
                            "managed_groups": [
                                {
                                    "id": 1,
                                    "name": "ИВТ-301",
                                    "course": 3
                                },
                                {
                                    "id": 2,
                                    "name": "ПИ-201",
                                    "course": 2
                                }
                            ]
                        },
                    response_only=True,
                ),
            ]
        )
    
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
            "is_own_profile": True
        }

        # Студент
        if user.is_student:
            student = getattr(user, 'student_profile', None)
            if student:
                # Используем твою функцию формирования данных
                student_data = get_student_full_profile(student, request, is_own_profile=True)
                response_data.update(student_data)
                response_data["type"] = "student"

        # Сотрудник (Проректор / Декан / Кафедра)
        elif hasattr(user, 'staff_profile'):
            staff = user.staff_profile
            response_data["type"] = "staff"
            response_data["faculty"] = staff.faculty.name if staff.faculty else "Не указан"
            
            # Определяем зону видимости (scope)
            students_queryset = Student.objects.all()
            
            if user.is_rectorate:
                response_data["scope"] = "university"
            elif user.is_dean:
                response_data["scope"] = "faculty"
                students_queryset = students_queryset.filter(faculty=staff.faculty)
            elif user.is_dept_staff:
                response_data["scope"] = "department"
                students_queryset = students_queryset.filter(department=staff.department)
                response_data["department"] = staff.department.name if staff.department else "Не указана"
            
            students_list_data = StudentProfileSerializer(students_queryset.select_related('group', 'faculty')[:200], many=True, context={'request': request}).data

            stats_data = students_queryset.aggregate(
                total_students=Count('id'),
                avg_score=Avg(
                    F('academic_score') + F('research_score') + 
                    F('sport_score') + F('social_score') + F('cultural_score')
                )
            )
            
            stats = {
                "total_students": stats_data['total_students'] or 0,
                "avg_score": round(stats_data['avg_score'] or 0, 2)
            }
            
            # Список документов на проверку
            pending_docs = Document.objects.filter(
                student__in=students_queryset,
                status='pending'
            ).select_related('student', 'student__group')

            # Формируем список документов с данными студента
            pending_docs_data = []
            for doc in pending_docs:
                doc_data = DocumentSerializer(doc).data
                doc_data.update({
                    'student_id': doc.student.id,
                    'student_name': doc.student.full_name,
                    'group_id': doc.student.group.id if doc.student.group else "—",
                    'record_book': doc.student.record_book
                })
                pending_docs_data.append(doc_data)

            response_data.update({
                "stats": stats,
                "students_list": students_list_data,
                "pending_documents": pending_docs_data,
                "managed_groups": list(Group.objects.filter(department=staff.department).values('id', 'name', 'course')) if staff.department else []
            })

        return Response(response_data)

class PublicProfileAPIView(APIView):
    """
    API-представление для просмотра профиля студента.

    Предоставляет доступ к полной информации о студенте. Просмотр чужого профиля
    разрешён только пользователям с правами персонала (например, из отдела, деканата или ректората).
    Обычные студенты могут просматривать только свой собственный профиль.
    """
    permission_classes = [IsAuthenticated]

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

        is_staff = request.user.groups.filter(name__in=['Department', 'Dean', 'Rectorate']).exists()
        
        target_student = get_object_or_404(Student, id=student_id)
        
        is_own_profile = (request.user.id == target_student.user.id)

        if not is_own_profile and not is_staff:
            return Response({"detail": "У вас нет прав для просмотра этого профиля."}, status=status.HTTP_403_FORBIDDEN)

        response_data = get_student_full_profile(target_student, request, is_own_profile)
        return Response(response_data)