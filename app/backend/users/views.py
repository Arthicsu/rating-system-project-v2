from drf_spectacular.utils import extend_schema, OpenApiExample, OpenApiParameter
from drf_spectacular.types import OpenApiTypes

from django.contrib.auth import login, logout, authenticate
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes


from university_structure.models import Faculty, Group
from students.models import Document, Student
from .serializers import StudentRegistrationSerializer
from students.serializers import DocumentSerializer, StudentProfileSerializer, StudentRatingSerializer

User = get_user_model()


@permission_classes([IsAuthenticated])
@authentication_classes([SessionAuthentication])  
def get_student_profile_data(user, request, is_own_profile, is_teacher):
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
        is_teacher (bool): Флаг, указывающий, является ли текущий пользователь преподавателем.
            Может использоваться в сериализаторе для расширенного отображения данных.

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
    
    serializer_context = {'request': request, 'is_own_profile': is_own_profile}
    student_data = StudentProfileSerializer(user.student_profile, context=serializer_context).data
    
    student_data["radar_stats"] = {
        "labels": [
            "Общественная", 
            "Учебная", 
            "Cпорт", 
            "Творческая", 
            "Научная"
        ],
        "data": [
            user.student_profile.social_score,
            user.student_profile.academic_score,
            user.student_profile.sport_score,
            user.student_profile.cultural_score,
            user.student_profile.research_score
        ]
    }
    return student_data

class RegistrationAPIView(APIView):
    """
    API-представление для регистрации нового студента.

    Позволяет анонимным пользователям зарегистрироваться в системе через передачу данных,
    таких как ФИО, номер зачётной книжки, логин, пароль и другие необходимые поля.
    После успешной валидации создаёт пользователя и связанный профиль студента,
    автоматически выполняет вход и возвращает базовую информацию о пользователе.
    """

    @permission_classes([AllowAny])
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
    
    @permission_classes([AllowAny])  
    def post(self, request):
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
                "full_name": user.get_full_username(),
            }, status=status.HTTP_201_CREATED)
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginAPIView(APIView):
    @permission_classes([AllowAny])  
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
                "full_name": user.get_full_username(),
            }, status=status.HTTP_200_OK)
        else:
            return Response({"detail": "Неверный логин или пароль"}, status=status.HTTP_401_UNAUTHORIZED)

class CheckAuthAPIView(APIView):
    @permission_classes([AllowAny])  
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
    @permission_classes([IsAuthenticated])
    @authentication_classes([SessionAuthentication])  
    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_200_OK)

class GroupListView(APIView): 
    @permission_classes([AllowAny])  
    def get(self, request):
        groups = Group.objects.all().values('id', 'name', 'course', 'faculty')
        return Response(list(groups))

class RatingAPIView(APIView):
    @permission_classes([AllowAny]) 
    def get(self, request):
        students = Student.objects.select_related('group', 'faculty').all()
        serializer = StudentRatingSerializer(students, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

# Всё же надо разделить, а то это ужас какой-то 
class PublicProfileAPIView(APIView):
    """
    API-представление для получения публичного профиля пользователя.

    Возвращает данные о пользователе в зависимости от его роли (студент или преподаватель)
    и прав текущего залогиненного пользователя. Поддерживает просмотр как своего, так и чужого профиля,
    с ограничением чувствительной информации (например, достижения со статусом pending) только для владельца или преподавателя.
    """

    @extend_schema(
            summary="Получение публичного профиля",
            description="API-представление для получения публичного профиля пользователя. " \
            "Возвращает данные о пользователе в зависимости от его роли (студент или преподаватель)" \
            "    и прав текущего залогиненного пользователя. Поддерживает просмотр как своего, так и чужого профиля," \
            "    с ограничением чувствительной информации (например, достижения со статусом pending) только для владельца или преподавателя.",
            responses={200: OpenApiTypes.OBJECT},
            examples=[
                OpenApiExample(
                    "Пример для студента",
                    value={
                        "id": 1,
                        "full_name": "Иванов Иван Иванович",
                        "is_student": True,
                        "is_teacher": False,
                        "is_own_profile": True,
                        "email": "student1@ya.ru",
                        "phone": "89621370605",
                        "user_id": 4,
                        "record_book": "23-01-5",
                        "group": "ИВТ-301",
                        "group_id": "1",
                        "course": 3,
                        "faculty": "ИЭИ",
                        "academic_score": 4,
                        "research_score": 3,
                        "sport_score": 4,
                        "social_score": 4,
                        "cultural_score": 7,
                        "total_score": 22,
                        "documents": [
                            {
                                "id": 1,
                                "category": "academic",
                                "category_display": "Учебная",
                                "sub_type": "grades",
                                "sub_type_display": "Успеваемость",
                                "level": "none",
                                "level_display": "Не применимо",
                                "result": "excellent",
                                "result_display": "Только \"отлично\"",
                                "achievement": "Тестовое достижение (Успеваемость)",
                                "rejection_reason": None,
                                "score": 2,
                                "status": "pending",
                                "doc_type": "diploma",
                                "doc_type_display": "Диплом",
                                "file_url": "https://wzmtxnmpqenmirlgdouy.supabase.co/storage/v1/object/public/achievement/23-01-5/d5391730-dec8-461f-90a7-d997d58f9296.pdf",
                                "original_file_name": "diplom2026.pdf",
                                "uploaded_at": "2026-02-14T16:34:20.133223Z"
                            }
                        ],
                        "radar_stats": {
                            "labels": [
                                "Общественная",
                                "Учебная",
                                "Cпорт",
                                "Творческая",
                                "Научная"
                            ],
                            "data": [
                                4,
                                4,
                                4,
                                7,
                                3
                            ]
                        }
                    },
                    response_only=True,
                ),
                OpenApiExample(
                    "Пример для кафедры",
                    value={
                        "id": 2,
                        "full_name": "Носов Дмитрий Александрович",
                        "is_student": False,
                        "is_teacher": True,
                        "is_own_profile": False,
                        "faculty": "Инженерно-экономический институт",
                        "position": "Преподаватель",
                        "curated_groups": [
                            {
                                "id": 1,
                                "name": "ИВТ-301",
                                "course": 3
                            }
                        ],
                        "students_list": [
                            {
                                "id": 2,
                                "user_id": 5,
                                "full_name": "Смирнов Алексей Алексеевич",
                                "phone": "",
                                "record_book": "23-01-6",
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
                                "documents": []
                            },],
                        "pending_documents": [],
                        "stats": {
                            "total_students": 6,
                            "avg_score": 3.7
                        },
                    },
                    response_only=True,
                ),
            ]
        )

    @permission_classes([IsAuthenticated])
    @authentication_classes([SessionAuthentication])  
    def get(self, request, user_id=None):
        """
        Обрабатывает GET-запрос на получение данных профиля.

        Если user_id не указан, возвращается профиль текущего пользователя.
        Определяет, является ли запрашиваемый профиль своим или чужим, а также роль пользователя.
        Для студентов возвращает их профиль с баллами и статистикой.
        Для преподавателей - информацию о курируемых группах, списках студентов, ожидающих документах и общей статистике.

        Параметры:
            request (Request): Объект HTTP-запроса с данными сессии и аутентификации.
            user_id (int, optional): ID пользователя, чей профиль запрашивается. По умолчанию - текущий пользователь.

        Возвращает:
            Response: JSON-ответ с полями:
                - id, full_name, is_student, is_teacher - общедоступные данные.
                - is_own_profile - флаг, указывающий, принадлежит ли профиль текущему пользователю.
                - email, phone - только если это свой профиль или текущий пользователь - преподаватель.
                - Данные студента (включая radar_stats) - если пользователь является студентом.
                - Информация о кураторских группах, студентах, документах и статистике - если пользователь - преподаватель.

        Особенности:
            - Доступ разрешён только аутентифицированным пользователям.
            - Используется сессионная аутентификация.
            - Чувствительные данные показываются только владельцу или преподавателю.
            - Для преподавателя собирается расширенная информация по курируемым группам и их студентам.
            - Статистика включает общее количество студентов и средний рейтинг.
        """

        target_user_id = user_id if user_id else request.user.id
        target_user = get_object_or_404(User, id=target_user_id)
        
        is_own_profile = (request.user.id == target_user.id)
        is_teacher = getattr(request.user, 'is_teacher', False)

        response_data = {
            "id": target_user.id,
            "full_name": target_user.get_full_username(),
            "is_student": target_user.is_student,
            "is_teacher": target_user.is_teacher,
            "is_own_profile": is_own_profile,
        }

        if is_own_profile or is_teacher:
            response_data["email"] = target_user.email
            phone = None
            if hasattr(target_user, 'student_profile'):
                phone = target_user.student_profile.phone
            elif hasattr(target_user, 'teacher_profile'):
                phone = target_user.teacher_profile.phone
            response_data["phone"] = phone

        if target_user.is_student and hasattr(target_user, 'student_profile'):
            student_full_data = get_student_profile_data(target_user, request, is_own_profile, is_teacher)
            response_data.update(student_full_data)

        elif target_user.is_teacher and hasattr(target_user, 'teacher_profile'):
            teacher = target_user.teacher_profile
            
            curated_groups = Group.objects.filter(curator=target_user)
            curated_groups_data = list(curated_groups.values('id', 'name', 'course'))
            
            students_list_data = []
            pending_docs_data = []
            stats = {}

            students_queryset = Student.objects.filter(group__in=curated_groups).select_related('group', 'faculty')
            students_list_data = StudentProfileSerializer(students_queryset, many=True).data
            
            total_students = students_queryset.count()
            avg_score = 0
            if total_students > 0:
                total_sum = sum(s.total_score for s in students_queryset)
                avg_score = round(total_sum / total_students, 1)
            
            stats = {"total_students": total_students, "avg_score": avg_score}

            pending_docs = Document.objects.filter(
                student__in=students_queryset, 
                status='pending'
            ).select_related('student', 'student__group')
            
            for doc in pending_docs:
                doc_data = DocumentSerializer(doc).data
                doc_data['student_id'] = doc.student.id
                doc_data['student_name'] = doc.student.full_name
                doc_data['group_id'] = doc.student.group.id
                doc_data['record_book'] = doc.student.record_book
                pending_docs_data.append(doc_data)

            response_data.update({
                "faculty": teacher.faculty.name if teacher.faculty else "Не указан",
                "position": teacher.position,
                "curated_groups": curated_groups_data,
                "students_list": students_list_data, 
                "pending_documents": pending_docs_data,
                "stats": stats
            })

        return Response(response_data)

class ProfileAPIView(PublicProfileAPIView):
    """
    API-представление для получения профиля текущего пользователя.

    Наследует функциональность из PublicProfileAPIView, но фиксирует user_id
    как ID текущего аутентифицированного пользователя. Используется для получения
    полных данных о собственном профиле — студента или преподавателя.
    """

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
                        "is_student": True,
                        "is_teacher": False,
                        "is_own_profile": True,
                        "email": "student1@ya.ru",
                        "phone": "89621370605",
                        "user_id": 4,
                        "record_book": "23-01-5",
                        "group": "ИВТ-301",
                        "group_id": "1",
                        "course": 3,
                        "faculty": "ИЭИ",
                        "academic_score": 4,
                        "research_score": 3,
                        "sport_score": 4,
                        "social_score": 4,
                        "cultural_score": 7,
                        "total_score": 22,
                        "documents": [
                            {
                                "id": 1,
                                "category": "academic",
                                "category_display": "Учебная",
                                "sub_type": "grades",
                                "sub_type_display": "Успеваемость",
                                "level": "none",
                                "level_display": "Не применимо",
                                "result": "excellent",
                                "result_display": "Только \"отлично\"",
                                "achievement": "Тестовое достижение (Успеваемость)",
                                "rejection_reason": None,
                                "score": 2,
                                "status": "pending",
                                "doc_type": "diploma",
                                "doc_type_display": "Диплом",
                                "file_url": "https://wzmtxnmpqenmirlgdouy.supabase.co/storage/v1/object/public/achievement/23-01-5/d5391730-dec8-461f-90a7-d997d58f9296.pdf",
                                "original_file_name": "diplom2026.pdf",
                                "uploaded_at": "2026-02-14T16:34:20.133223Z"
                            }    
                        ],
                        "radar_stats": {
                            "labels": [
                                "Общественная",
                                "Учебная",
                                "Cпорт",
                                "Творческая",
                                "Научная"
                            ],
                            "data": [
                                4,
                                4,
                                4,
                                7,
                                3
                            ]
                        }
                    },
                    response_only=True,
                ),
                OpenApiExample(
                    "Пример для кафедры",
                    value={
                        "id": 2,
                        "full_name": "Носов Дмитрий Александрович",
                        "is_student": False,
                        "is_teacher": True,
                        "is_own_profile": True,
                        "email": "nosov@ya.ru",
                        "phone": "",
                        "faculty": "Инженерно-экономический институт",
                        "position": "Преподаватель",
                        "curated_groups": [
                            {
                                "id": 1,
                                "name": "ИВТ-301",
                                "course": 3
                            }
                        ],
                        "students_list": [
                            {
                                "id": 1,
                                "user_id": 4,
                                "full_name": "Иванов Иван Иванович",
                                "phone": "89621370605",
                                "record_book": "23-01-5",
                                "group": "ИВТ-301",
                                "group_id": "1",
                                "course": 3,
                                "faculty": "ИЭИ",
                                "academic_score": 4,
                                "research_score": 3,
                                "sport_score": 4,
                                "social_score": 4,
                                "cultural_score": 7,
                                "total_score": 22,
                                "documents": [
                                    {
                                        "id": 1,
                                        "category": "academic",
                                        "category_display": "Учебная",
                                        "sub_type": "grades",
                                        "sub_type_display": "Успеваемость",
                                        "level": "none",
                                        "level_display": "Не применимо",
                                        "result": "excellent",
                                        "result_display": "Только \"отлично\"",
                                        "achievement": "Тестовое достижение (Успеваемость)",
                                        "rejection_reason": None,
                                        "score": 2,
                                        "status": "pending",
                                        "doc_type": "diploma",
                                        "doc_type_display": "Диплом",
                                        "file_url": "https://wzmtxnmpqenmirlgdouy.supabase.co/storage/v1/object/public/achievement/23-01-5/d5391730-dec8-461f-90a7-d997d58f9296.pdf",
                                        "original_file_name": "diplom2026.pdf",
                                        "uploaded_at": "2026-02-14T16:34:20.133223Z"
                                    }
                                ]
                            }
                        ],
                        "pending_documents": [
                            {
                                "id": 1,
                                "category": "academic",
                                "category_display": "Учебная",
                                "sub_type": "grades",
                                "sub_type_display": "Успеваемость",
                                "level": "none",
                                "level_display": "Не применимо",
                                "result": "excellent",
                                "result_display": "Только \"отлично\"",
                                "achievement": "Тестовое достижение (Успеваемость)",
                                "rejection_reason": None,
                                "score": 2,
                                "status": "pending",
                                "doc_type": "diploma",
                                "doc_type_display": "Диплом",
                                "file_url": "https://wzmtxnmpqenmirlgdouy.supabase.co/storage/v1/object/public/achievement/23-01-5/d5391730-dec8-461f-90a7-d997d58f9296.pdf",
                                "original_file_name": "diplom2026.pdf",
                                "uploaded_at": "2026-02-14T16:34:20.133223Z",
                                "student_id": 1,
                                "student_name": "Иванов Иван Иванович",
                                "group_id": 1,
                                "record_book": "23-01-5"
                            }
                        ],
                        "stats": {
                            "total_students": 6,
                            "avg_score": 3.7
                        }
                    },
                    response_only=True,
                ),
            ]
        )
    
    @authentication_classes([SessionAuthentication])
    def get(self, request):
        """
        Обрабатывает GET-запрос на получение профиля текущего пользователя.

        Автоматически подставляет ID текущего пользователя (request.user.id)
        в качестве целевого user_id и вызывает родительский метод из PublicProfileAPIView.
        Таким образом, пользователь всегда получает данные о себе.

        Параметры:
            request (Request): Объект HTTP-запроса с аутентифицированным пользователем.

        Возвращает:
            Response: Ответ от родительского класса, содержащий полные данные профиля
                     текущего пользователя, включая личную информацию, академические
                     и внеучебные показатели, статистику и документы (в зависимости от роли).

        Особенности:
            - Доступ разрешён только аутентифицированным пользователям (наследуется из родителя).
            - Используется сессионная аутентификация.
            - Поддерживает гибкое формирование ответа: для студентов - баллы и radar-статистика,
              для преподавателей - данные по курируемым группам и ожидающим модерации документам.

        Примечание:
            Метод не содержит собственной логики, а делегирует выполнение родительскому классу,
            обеспечивая удобную и безопасную точку доступа к личному профилю.
        """
        return super().get(request, user_id=request.user.id)