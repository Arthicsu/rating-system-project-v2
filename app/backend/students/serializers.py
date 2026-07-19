from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from .models import Student, Document, Category, DocumentFile, Level, AchievementResult, DocType, AchievementType, SemesterScore

import os
import logging

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {'.pdf', '.docx', '.doc', '.png', '.jpeg', '.jpg', '.webp', '.gif', '.bmp'}
ALLOWED_CONTENT_TYPES = {
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/octet-stream',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/bmp',
}
MAX_FILE_SIZE = 20 * 1024 * 1024  # Ограничение на размер файла (20 МБ)
MAX_TOTAL_SIZE = 20 * 1024 * 1024  # Суммарный лимит на все файлы заявки (20 МБ)
MAX_FILES = 3  # Максимальное количество файлов

# Сигнатуры разрешённых форматов и содержимое сверяется с этим расширением.
FILE_SIGNATURES = {
    '.pdf': (b'%PDF-',),
    '.doc': (b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1',),
    '.docx': (b'PK\x03\x04', b'PK\x05\x06', b'PK\x07\x08'),
    '.png': (b'\x89PNG\r\n\x1a\n',),
    '.jpg': (b'\xff\xd8\xff',),
    '.jpeg': (b'\xff\xd8\xff',),
    '.gif': (b'GIF87a', b'GIF89a'),
    '.bmp': (b'BM',),
    '.webp': (b'RIFF',),
}


def validate_achievement_files(files):
    """
    Общая валидация прикреплённых файлов достижения: количество, размер,
    расширение и MIME-тип. Используется и при загрузке, и при редактировании.
    """
    if len(files) > MAX_FILES:
        raise serializers.ValidationError(f"Нельзя загрузить более {MAX_FILES} файлов.")

    total_size = sum(file.size for file in files)
    if total_size > MAX_TOTAL_SIZE:
        raise serializers.ValidationError("Суммарный размер файлов не должен превышать 20 МБ.")

    for file in files:
        if file.size > MAX_FILE_SIZE:
            raise serializers.ValidationError(f"Файл {file.name} слишком большой. Максимальный размер 20 МБ.")

        ext = os.path.splitext(file.name)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError(f"Формат {ext} не поддерживается для файла {file.name}.")

        # Проверка mime-типа
        if file.content_type not in ALLOWED_CONTENT_TYPES:
            raise serializers.ValidationError(f"Недопустимый тип содержимого для {file.name}.")

        # Проверка сигнатуры реальное содержимое должно соответствовать расширению (см. FILE_SIGNATURES).
        header = file.read(12)
        file.seek(0)
        ok = any(header.startswith(sig) for sig in FILE_SIGNATURES.get(ext, ()))
        if ext == '.webp':
            ok = ok and header[8:12] == b'WEBP'
        if not ok:
            raise serializers.ValidationError(
                f"Содержимое файла {file.name} не соответствует расширению {ext}."
            )
    return files


class LevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Level
        fields = ['code', 'label']


class AchievementResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = AchievementResult
        fields = ['code', 'label']


class DocTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocType
        fields = ['code', 'label']


class AchievementTypeSerializer(serializers.ModelSerializer):
    allowed_results = serializers.SerializerMethodField()

    class Meta:
        model = AchievementType
        fields = ['code', 'label', 'needs_level', 'needs_result', 'allowed_results']

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_allowed_results(self, obj):
        return list(
            set(
                rule.result.code
                for rule in obj.rules.all()
                if rule.result and rule.result.code != 'none'
            )
        )


class CategorySerializer(serializers.ModelSerializer):
    sub_types = AchievementTypeSerializer(many=True, read_only=True)

    class Meta:
        model = Category
        fields = ['code', 'label', 'sub_types']


class AchievementConfigSerializer(serializers.Serializer):
    structure = serializers.SerializerMethodField()
    levels = serializers.SerializerMethodField()
    results = serializers.SerializerMethodField()
    doc_types = serializers.SerializerMethodField()

    @extend_schema_field(serializers.DictField())
    def get_structure(self, obj):
        return obj

    @extend_schema_field(LevelSerializer(many=True))
    def get_levels(self, obj):
        return LevelSerializer(
            Level.objects.exclude(code='none'), many=True
        ).data

    @extend_schema_field(AchievementResultSerializer(many=True))
    def get_results(self, obj):
        return AchievementResultSerializer(
            AchievementResult.objects.exclude(code='none'), many=True
        ).data

    @extend_schema_field(DocTypeSerializer(many=True))
    def get_doc_types(self, obj):
        return DocTypeSerializer(DocType.objects.all(), many=True).data

class RatingRowMixin(serializers.Serializer):
    """
    Общие поля строки рейтинга/списка студентов (модель Student).

    Единый источник для StudentRatingSerializer (живые баллы текущего семестра)
    и SemesterStudentListSerializer (аннотации sem_* выбранного семестра) —
    раньше эти наборы полей были продублированы.
    """
    group_id = serializers.IntegerField(source='group.id', read_only=True)
    group = serializers.CharField(source='group.name', read_only=True, default="Без группы")
    course = serializers.IntegerField(source='group.course', read_only=True, default=0)
    faculty = serializers.CharField(source='faculty.short_name', read_only=True, default="—")
    short_name = serializers.SerializerMethodField()

    BASE_FIELDS = [
        'id', 'user_id',
        'full_name', 'short_name',
        'group', 'group_id',
        'course',
        'faculty',
        'total_score', 'academic_score', 'research_score', 'sport_score', 'social_score', 'cultural_score',
    ]

    @extend_schema_field(serializers.CharField())
    def get_short_name(self, obj):
        if obj.user:
            return obj.user.get_user_display_short_name()
        return obj.full_name


class StudentRatingSerializer(RatingRowMixin, serializers.ModelSerializer):
    """
    Строка публичного рейтинга: живые баллы текущего семестра из кэша Student.
    Ручка доступна только сотрудникам, поэтому зачётка в выдаче допустима
    (по ней работает поиск и колонка в таблице кабинета).
    """
    faculty_id = serializers.IntegerField(source='faculty.id', read_only=True, default=0)
    total_score = serializers.ReadOnlyField()

    class Meta:
        model = Student
        fields = RatingRowMixin.BASE_FIELDS + ['faculty_id', 'record_book']

class SemesterScoreSerializer(serializers.ModelSerializer):
    """Строка истории баллов студента за один семестр."""
    semester_id = serializers.IntegerField(source='semester.id', read_only=True)
    semester_label = serializers.CharField(source='semester.label', read_only=True)
    is_current = serializers.BooleanField(source='semester.is_current', read_only=True)
    start_date = serializers.DateField(source='semester.start_date', read_only=True)
    end_date = serializers.DateField(source='semester.end_date', read_only=True)

    class Meta:
        model = SemesterScore
        fields = [
            'semester_id', 'semester_label', 'is_current', 'start_date', 'end_date',
            'total_score', 'academic_score', 'research_score', 'sport_score', 'social_score', 'cultural_score',
        ]

class SemesterRatingSerializer(serializers.ModelSerializer):
    """
    НЕ ИСПОЛЬЗУЕТСЯ (проверено: нигде не импортируется). Оставлен намеренно —
    на случай возвращения исторического рейтинга по строкам SemesterScore.

    Рейтинг за прошлый семестр: сериализует строки SemesterScore в тот же формат, что и
    StudentRatingSerializer, чтобы фронтенд обрабатывал текущий и исторический рейтинг одинаково.
    """
    id = serializers.IntegerField(source='student.id', read_only=True)
    user_id = serializers.IntegerField(source='student.user_id', read_only=True)
    full_name = serializers.CharField(source='student.full_name', read_only=True)
    short_name = serializers.SerializerMethodField()
    group_id = serializers.IntegerField(source='student.group.id', read_only=True, default=0)
    group = serializers.CharField(source='student.group.name', read_only=True, default="Без группы")
    course = serializers.IntegerField(source='student.group.course', read_only=True, default=0)
    faculty = serializers.CharField(source='student.faculty.short_name', read_only=True, default="—")
    faculty_id = serializers.IntegerField(source='student.faculty.id', read_only=True, default=0)

    class Meta:
        model = SemesterScore
        fields = [
            'id', 'user_id',
            'full_name', 'short_name',
            'group', 'group_id',
            'course',
            'faculty', 'faculty_id',
            'total_score', 'academic_score', 'research_score', 'sport_score', 'social_score', 'cultural_score',
        ]

    @extend_schema_field(serializers.CharField())
    def get_short_name(self, obj):
        if obj.student.user:
            return obj.student.user.get_user_display_short_name()
        return obj.student.full_name

class SemesterStudentListSerializer(RatingRowMixin, serializers.ModelSerializer):
    """
    Строка таблицы студентов в /staff-profile за ПРОШЛЫЙ семестр.

    Обычный Student (показываем ВСЕХ отфильтрованных студентов), но баллы берутся из аннотаций
    выбранного семестра (`sem_*`, 0 при отсутствии строки SemesterScore). По форме совпадает с
    тем, что таблица читает из StudentProfileSerializer.
    """
    total_score = serializers.IntegerField(source='sem_total_score', read_only=True)
    academic_score = serializers.IntegerField(source='sem_academic_score', read_only=True)
    research_score = serializers.IntegerField(source='sem_research_score', read_only=True)
    sport_score = serializers.IntegerField(source='sem_sport_score', read_only=True)
    social_score = serializers.IntegerField(source='sem_social_score', read_only=True)
    cultural_score = serializers.IntegerField(source='sem_cultural_score', read_only=True)

    class Meta:
        model = Student
        fields = RatingRowMixin.BASE_FIELDS + ['record_book']

class DocumentFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentFile
        fields = [
            'id',
            'original_file_name',
            'uploaded_at',
            'order',
            'document',
        ]

class DocumentSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='category.label', read_only=True)
    sub_type_display = serializers.CharField(source='sub_type.label', read_only=True)
    level_display = serializers.CharField(source='level.label', read_only=True, default=None)
    result_display = serializers.CharField(source='result.label', read_only=True, default=None)
    doc_type_display = serializers.CharField(source='doc_type.label', read_only=True)
    status_display = serializers.CharField(source='status.code', read_only=True)
    files = DocumentFileSerializer(many=True, read_only=True)

    class Meta:
        model = Document
        fields = [
            'id',
            'category', 'category_display',
            'sub_type', 'sub_type_display',
            'level', 'level_display',
            'result', 'result_display',
            'achievement',
            'rejection_reason',
            'score',
            'status', 'status_display',
            'doc_type', 'doc_type_display',
            'files',
            'date_received', 'uploaded_at',
        ]

class PendingDocumentSerializer(DocumentSerializer):
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    student_id = serializers.IntegerField(source='user.student_profile.id', read_only=True)
    student_name = serializers.CharField(source='user.student_profile.full_name', read_only=True)
    course = serializers.IntegerField(source='user.student_profile.group.course', read_only=True)
    faculty = serializers.CharField(source='user.student_profile.faculty.short_name', read_only=True, default="—")
    group = serializers.CharField(source='user.student_profile.group.name', read_only=True, default="Без группы")
    group_id = serializers.IntegerField(source='user.student_profile.group.id', read_only=True)
    record_book = serializers.CharField(source='user.student_profile.record_book', read_only=True, default="—")

    class Meta(DocumentSerializer.Meta):
        fields = DocumentSerializer.Meta.fields + ['user_id', 'student_id', 'student_name', 'group', 'group_id', 'course', 'faculty', 'record_book']

class StudentProfileSerializer(serializers.ModelSerializer):
    group = serializers.CharField(source='group.name', read_only=True, default="Без группы")
    group_id = serializers.IntegerField(source='group.id', read_only=True)
    course = serializers.IntegerField(source='group.course', read_only=True)
    faculty = serializers.CharField(source='faculty.short_name', read_only=True, default="—")
    documents = DocumentSerializer(many=True, read_only=True, source='user.documents')
    total_score = serializers.ReadOnlyField()
    short_name = serializers.SerializerMethodField()
    semester_history = serializers.SerializerMethodField()
    is_archived = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            'id', 'user_id',
            'full_name', 'short_name',
            'email', 'record_book',
            'group', 'group_id', 'course', 'faculty',
            'status', 'status_decoding', 'archived_at', 'is_archived',
            'academic_score', 'research_score', 'sport_score', 'social_score', 'cultural_score', 'total_score',
            'documents',
            'semester_history',
        ]

    @extend_schema_field(serializers.CharField())
    def get_short_name(self, obj):
        if obj.user:
            return obj.user.get_user_display_short_name()
        return obj.full_name

    @extend_schema_field(serializers.BooleanField())
    def get_is_archived(self, obj):
        return obj.archived_at is not None

    @extend_schema_field(SemesterScoreSerializer(many=True))
    def get_semester_history(self, obj):
        rows = (
            obj.semester_scores
            .select_related('semester')
            .order_by('-semester__start_date')
        )
        return SemesterScoreSerializer(rows, many=True).data

class AchievementUploadSerializer(serializers.Serializer):
    record_book = serializers.CharField(required=True)
    category = serializers.SlugRelatedField(queryset=Category.objects.all(), slug_field='code')
    sub_type = serializers.CharField()
    level = serializers.SlugRelatedField(queryset=Level.objects.all(), slug_field='code', required=False, allow_null=True)
    result = serializers.SlugRelatedField(queryset=AchievementResult.objects.all(), slug_field='code', required=False, allow_null=True)
    achievement = serializers.CharField()
    date_received = serializers.DateField(required=False)
    doc_type = serializers.SlugRelatedField(queryset=DocType.objects.all(), slug_field='code', default='other')
    files = serializers.ListField(child=serializers.FileField(), write_only=True, required=True)

    def validate_files(self, files):
        return validate_achievement_files(files)

    def validate(self, data):
        # Проверяем подтип в рамках категории
        try:
            data['sub_type'] = AchievementType.objects.get(category=data['category'], code=data['sub_type'])
        except AchievementType.DoesNotExist:
            raise serializers.ValidationError({"sub_type": "Неверный подтип для данной категории."})

        # БЕЗОПАСНОСТЬ: владелец достижения определяется по аутентифицированному
        # пользователю, а НЕ по record_book из тела запроса. Иначе любой студент мог
        # бы загружать достижения на чужую зачётку.
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        student = getattr(user, 'student_profile', None)
        if student is None:
            raise serializers.ValidationError(
                {"student": "Загружать достижения можно только со своего профиля студента."}
            )

        data['user'] = user
        return data

    def create(self, validated_data):
        from .services import create_achievement

        files = validated_data.pop('files')
        user = validated_data.pop('user')
        validated_data.pop('record_book')

        return create_achievement(user=user, files=files, **validated_data)


class AchievementUpdateSerializer(serializers.Serializer):
    """
    Частичное редактирование достижения студентом (PATCH).

    Все поля опциональны. Подтип проверяется в рамках категории (переданной или
    текущей). Если переданы файлы — старые удаляются и заменяются новыми.
    Балл пересчитывается в `Document.save()`. Если документ был отклонён, при
    сохранении он возвращается на повторное рассмотрение (статус 'pending').

    Редактирование уже подтверждённых достижений запрещается на уровне view.
    """
    category = serializers.SlugRelatedField(queryset=Category.objects.all(), slug_field='code', required=False)
    sub_type = serializers.CharField(required=False)
    level = serializers.SlugRelatedField(queryset=Level.objects.all(), slug_field='code', required=False, allow_null=True)
    result = serializers.SlugRelatedField(queryset=AchievementResult.objects.all(), slug_field='code', required=False, allow_null=True)
    achievement = serializers.CharField(required=False)
    date_received = serializers.DateField(required=False)
    doc_type = serializers.SlugRelatedField(queryset=DocType.objects.all(), slug_field='code', required=False)
    files = serializers.ListField(child=serializers.FileField(), write_only=True, required=False)

    def validate_files(self, files):
        return validate_achievement_files(files)

    def validate(self, data):
        instance = self.instance
        category = data.get('category', instance.category)

        if 'sub_type' in data:
            try:
                data['sub_type'] = AchievementType.objects.get(category=category, code=data['sub_type'])
            except AchievementType.DoesNotExist:
                raise serializers.ValidationError({"sub_type": "Неверный подтип для данной категории."})
        elif 'category' in data and instance.sub_type.category_id != category.id:
            # Категорию сменили, но подтип не передали — текущий подтип не из новой категории.
            raise serializers.ValidationError({"sub_type": "При смене категории необходимо указать подтип."})

        return data

    def update(self, instance, validated_data):
        from .services import update_achievement

        files = validated_data.pop('files', None)
        return update_achievement(instance, validated_data, files=files)
