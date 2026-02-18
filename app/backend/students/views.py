from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import authentication_classes, permission_classes
from students.serializers import DocumentSerializer, StudentProfileSerializer

from students.models import Document, Student
from .scoring import calculate_achievement_score, get_scoring_structure, get_choices_from_config

import json, uuid
from supabase import create_client, Client
from backend.settings import SUPABASE_KEY, SUPABASE_URL, SUPABASE_BUCKET_NAME


supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def get_student_radar_data(student):
    """Динамическое формирование данных радара из конфига"""
    categories = get_choices_from_config('categories')
    labels = []
    values = []
    
    for key, label in categories:
        labels.append(label)
        values.append(getattr(student, f"{key}_score", 0))
        
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
            - levels (list): Список доступных уровней (исключая 'none').
            - results (list): Список доступных результатов (исключая 'none').
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
        Значения 'none' исключаются из списков уровней и результатов,
        т.к они используются как заглушки в модели, но не предназначены для выбора пользователями.
    """

    data = {
        "structure": get_scoring_structure(),
        "levels": [{"value": v, "label": l} for v, l in get_choices_from_config('metadata.levels') if v != 'none'],
        "results": [{"value": v, "label": l} for v, l in get_choices_from_config('metadata.results') if v != 'none'],
        "doc_types": [{"value": v, "label": l} for v, l in get_choices_from_config('metadata.doc_types')]
    }
    return Response(data)

# пока уберу
@api_view(['POST'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def upload_achievement(request):
    """
    Обрабатывает загрузку нового достижения студента.

    Принимает POST-запрос с данными о достижении и прикреплёнными файлами,
    сохраняет файл в облачное хранилище (Supabase Storage было тестовым решением, далее будем переделывать в зависимости от требований), 

    создаёт запись в модели Document 
    и начисляет баллы на основе категории, подтипа, уровня и результата.

    Параметры запроса (в form-data):
        record_book (str): Номер зачётной книжки студента (обязательный).
        category (str): Категория достижения (например, 'academic', 'sport').
        sub_type (str): Подтип достижения (например, 'olympiad', 'grades'). По умолчанию 'other'.
        level (str): Уровень мероприятия (например, 'university', 'russian'). По умолчанию 'none'.
        result (str): Результат участия (например, '1', 'excellent'). По умолчанию 'other'.
        achievement (str): Описание или название достижения.
        doc_type (str): Тип документа (например, 'diploma', 'certificate'). По умолчанию 'other'.
        files (list of files): Один или несколько файлов, подтверждающих достижение.

    Логика работы:
        1. Находит студента по номеру зачётной книжки (без учёта регистра).
        2. Вычисляет баллы с помощью функции calculate_achievement_score.
        3. Загружает каждый файл в Supabase Storage с уникальным именем.
        4. Сохраняет публичную ссылку на файл и все данные в модели Document со статусом 'pending'.

    Возвращает:
        Response: 
            - 201 Created — при успешной загрузке.
            - 500 Internal Server Error - если студент не найден, файл не загрузился или произошла ошибка валидации.

    Особенности:
        - Использует bucket с именем "achievement".
        - Для каждого файла генерируется уникальное имя на основе UUID для избежания коллизий.
        - При ошибке загрузки любого из файлов возвращается ошибка, и дальнейшая обработка прерывается.
        - CSRF отключён, так как предполагается использование API без сессий.

    Пример успешного ответа:
        HTTP 201 Created
    """
    
    if request.method == 'POST':
        record_book = request.POST.get('record_book', '').strip()
        category = request.POST.get('category')
        sub_type = request.POST.get('sub_type', 'other')
        level = request.POST.get('level', 'none')
        result = request.POST.get('result', 'other')
        achievement_text = request.POST.get('achievement', '')
        files = request.FILES.getlist('files')
        doc_type = request.POST.get('doc_type', 'other')

        score = calculate_achievement_score(category, sub_type, level, result)
    
        try:
            student = Student.objects.get(record_book__iexact=record_book)
            bucket_name = "achievement"
            # bucket_name = SUPABASE_BUCKET_NAME
            original_file_name = None
            file_url = None

            if files:
                for file in files:
                    ext = file.name.split('.')[-1]
                    original_file_name = file.name
                    unique_name = f"{uuid.uuid4()}.{ext}"
                    storage_path = f"{student.record_book}/{unique_name}"

                    try:
                        file.seek(0)
                        file_data = file.read()

                        supabase.storage.from_(bucket_name).upload(
                            path=storage_path,
                            file=file_data,
                            file_options={
                                "cache-control": "3600",
                                "upsert": "false",
                                "content-type": file.content_type
                            }
                        )

                        file_url = supabase.storage.from_(bucket_name).get_public_url(storage_path)

                        Document.objects.create(
                            student=student,
                            category=category,
                            sub_type=sub_type,
                            level=level,
                            result=result,
                            achievement=achievement_text,
                            score=score,
                            doc_type=doc_type,
                            original_file_name=original_file_name,
                            file_url=file_url,
                            status='pending'
                        )
                    
                    except Exception as e:
                        print(f"Ошибка загрузки файла {file.name}: {e}")
                        return Response({'error': f'{str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
        except Student.DoesNotExist:
            return Response({'error': f'Студент {record_book} не найден'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response({'error': f'{str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response(status=status.HTTP_201_CREATED)