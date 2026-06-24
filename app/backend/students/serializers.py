from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from university_structure.models import Faculty
from django.db import transaction
from django.core.cache import cache
from .models import Student, Document, Category, DocumentFile, Level, AchievementResult, DocType, AchievementType, DocumentStatus, ScoringRule
from .scoring import calculate_achievement_score

import os
import logging

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {'.pdf', '.docx', '.doc'}
ALLOWED_CONTENT_TYPES = {'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'application/octet-stream'}
MAX_FILE_SIZE = 20 * 1024 * 1024  # Ограничение на размер файла (20 МБ)
MAX_FILES = 3  # Максимальное количество файлов


def validate_achievement_files(files):
    """
    Общая валидация прикреплённых файлов достижения: количество, размер,
    расширение и MIME-тип. Используется и при загрузке, и при редактировании.
    """
    if len(files) > MAX_FILES:
        raise serializers.ValidationError(f"Нельзя загрузить более {MAX_FILES} файлов.")

    for file in files:
        if file.size > MAX_FILE_SIZE:
            raise serializers.ValidationError(f"Файл {file.name} слишком большой. Максимальный размер 20 МБ.")

        ext = os.path.splitext(file.name)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError(f"Формат {ext} не поддерживается для файла {file.name}.")

        # Проверка mime-типа
        if file.content_type not in ALLOWED_CONTENT_TYPES:
            raise serializers.ValidationError(f"Недопустимый тип содержимого для {file.name}.")
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

class StudentRatingSerializer(serializers.ModelSerializer):
    """
    Сериализатор для модели Student.

    Предназначен для преобразования объектов модели Student в json-формат и обратно.
    Включает основные поля студента, такие как личные данные, учебная группа, курс и различные баллы,
    используемые для рейтинговой оценки внеучебной деятельности студента.
    """
    group_id = serializers.IntegerField(source='group.id', read_only=True)
    group = serializers.CharField(source='group.name', read_only=True, default="Без группы")
    course = serializers.IntegerField(source='group.course', read_only=True, default=0)
    faculty = serializers.CharField(source='faculty.short_name', read_only=True, default="—")
    faculty_id = serializers.IntegerField(source='faculty.id', read_only=True, default=0)
    total_score = serializers.ReadOnlyField()
    short_name = serializers.SerializerMethodField()

    class Meta:
        model = Student
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
        if obj.user:
            return obj.user.get_user_display_short_name()
        return obj.full_name

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
    group_id = serializers.IntegerField(source='user.student_profile.group.id', read_only=True)
    record_book = serializers.CharField(source='user.student_profile.record_book', read_only=True, default="—")

    class Meta(DocumentSerializer.Meta):
        fields = DocumentSerializer.Meta.fields + ['user_id', 'student_id', 'student_name', 'group_id', 'record_book']

class StudentProfileSerializer(serializers.ModelSerializer):
    group = serializers.CharField(source='group.name', read_only=True, default="Без группы")
    group_id = serializers.IntegerField(source='group.id', read_only=True)
    course = serializers.IntegerField(source='group.course', read_only=True)
    faculty = serializers.CharField(source='faculty.short_name', read_only=True, default="—")
    documents = DocumentSerializer(many=True, read_only=True, source='user.documents')
    total_score = serializers.ReadOnlyField()
    short_name = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            'id', 'user_id', 
            'full_name', 'short_name',
            'email', 'record_book', 
            'group', 'group_id', 'course', 'faculty',
            'academic_score', 'research_score', 'sport_score', 'social_score', 'cultural_score', 'total_score',
            'documents',
        ]
    
    @extend_schema_field(serializers.CharField())
    def get_short_name(self, obj):
        if obj.user:
            return obj.user.get_user_display_short_name()
        return obj.full_name

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
        files_data = validated_data.pop('files')
        user = validated_data.pop('user')
        record_book = validated_data.pop('record_book')

        status_obj = DocumentStatus.objects.get(code='pending')

        # Рассчитываем баллы
        score = calculate_achievement_score(
            validated_data['category'].code,
            validated_data['sub_type'].code,
            validated_data.get('level').code if validated_data.get('level') else None,
            validated_data.get('result').code if validated_data.get('result') else None
        )

        with transaction.atomic():
            document = Document.objects.create(
                user=user,
                status=status_obj,
                score=score,
                **validated_data
            )

            for order, file in enumerate(files_data):
                DocumentFile.objects.create(
                    document=document,
                    file=file,
                    original_file_name=file.name,
                    order=order
                )

        return document


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
        files = validated_data.pop('files', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # Повторная подача: отклонённая заявка снова уходит на рассмотрение.
        if instance.status.code == 'rejected':
            instance.status = DocumentStatus.objects.get(code='pending')
            instance.rejection_reason = ''

        with transaction.atomic():
            instance.save()  # балл пересчитывается в Document.save()

            if files is not None:
                old_files = list(instance.files.all())
                instance.files.all().delete()

                for order, file in enumerate(files):
                    DocumentFile.objects.create(
                        document=instance,
                        file=file,
                        original_file_name=file.name,
                        order=order,
                    )

                # Старые файлы удаляем из хранилища только после коммита
                def _cleanup_old_files(files_to_remove=old_files):
                    for old_file in files_to_remove:
                        try:
                            old_file.file.delete(save=False)
                        except Exception:
                            logger.exception("Не удалось удалить старый файл достижения из хранилища")

                transaction.on_commit(_cleanup_old_files)

        return instance