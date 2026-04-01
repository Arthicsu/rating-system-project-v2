from rest_framework import serializers
from university_structure.models import Faculty
from django.db import transaction
from .models import Student, Document, Category, DocumentFile, Level, AchievementResult, DocType, AchievementType, DocumentStatus
from .scoring import calculate_achievement_score

import os
class StudentRatingSerializer(serializers.ModelSerializer):
    """
    Сериализатор для модели Student.

    Предназначен для преобразования объектов модели Student в json-формат и обратно.
    Включает основные поля студента, такие как личные данные, учебная группа, курс и различные баллы,
    используемые для рейтинговой оценки внеучебной деятельности студента.
    """
    
    group = serializers.CharField(source='group.name', read_only=True, default="Без группы")
    course = serializers.IntegerField(source='group.course', read_only=True, default=0)
    faculty = serializers.CharField(source='faculty.short_name', read_only=True, default="—")
    total_score = serializers.ReadOnlyField()

    class Meta:
        model = Student
        fields = [
            'id',
            'user_id', 
            'full_name', 
            'group', 
            'course', 
            'faculty',
            'total_score',
            'academic_score', 
            'research_score', 
            'sport_score', 
            'social_score', 
            'cultural_score',
        ]

class DocumentFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentFile
        fields = '__all__'

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
    student_id = serializers.IntegerField(source='user.student_profile.id', read_only=True)
    student_name = serializers.CharField(source='user.student_profile.get_full_username', read_only=True)
    group_id = serializers.IntegerField(source='user.student_profile.group.id', read_only=True)
    record_book = serializers.CharField(source='user.student_profile.record_book', read_only=True, default="—")

    class Meta(DocumentSerializer.Meta):
        fields = DocumentSerializer.Meta.fields + ['student_id', 'student_name', 'group_id', 'record_book']

class StudentProfileSerializer(serializers.ModelSerializer):
    group = serializers.CharField(source='group.name', read_only=True, default="Без группы")
    group_id = serializers.IntegerField(source='group.id', read_only=True)
    course = serializers.IntegerField(source='group.course', read_only=True)
    faculty = serializers.CharField(source='faculty.short_name', read_only=True, default="—")
    documents = DocumentSerializer(many=True, read_only=True, source='user.documents')
    total_score = serializers.ReadOnlyField()

    class Meta:
        model = Student
        fields = [
            'id', 'user_id', 
            'full_name', 'email', 'record_book', 
            'group', 'group_id', 'course', 'faculty',
            'academic_score', 'research_score', 'sport_score', 'social_score', 'cultural_score', 'total_score',
            'documents',
        ]

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = [
            'code', 'label',
        ]

ALLOWED_EXTENSIONS = {'.pdf', '.docx', '.doc'}
ALLOWED_CONTENT_TYPES = {'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'}
class AchievementUploadSerializer(serializers.Serializer):
    record_book = serializers.CharField(required=True)
    category = serializers.SlugRelatedField(queryset=Category.objects.all(), slug_field='code')
    sub_type = serializers.CharField()
    level = serializers.SlugRelatedField(queryset=Level.objects.all(), slug_field='code', required=False, allow_null=True)
    result = serializers.SlugRelatedField(queryset=AchievementResult.objects.all(), slug_field='code', required=False, allow_null=True)
    achievement = serializers.CharField()
    doc_type = serializers.SlugRelatedField(queryset=DocType.objects.all(), slug_field='code', default='other')
    files = serializers.ListField(
        child=serializers.FileField(), 
        write_only=True,
        required=True
    )

    def validate_files(self, files):
        max_size = 20 * 1024 * 1024  # Ограничение на размер файла (20 МБ)
        for file in files:
            if file.size > max_size:
                raise serializers.ValidationError(f"Файл {file.name} слишком большой. Максимальный размер 20 МБ.")
            
            ext = os.path.splitext(file.name)[1].lower()
            if ext not in ALLOWED_EXTENSIONS:
                raise serializers.ValidationError(f"Формат {ext} не поддерживается для файла {file.name}. Разрешены: {', '.join(ALLOWED_EXTENSIONS)}")
            
            # Проверка mime-типа
            if file.content_type not in ALLOWED_CONTENT_TYPES:
                raise serializers.ValidationError(f"Недопустимый тип содержимого для {file.name}.")
        return files

    def validate(self, data):
        # Проверяем подтип в рамках категории
        try:
            data['sub_type'] = AchievementType.objects.get(category=data['category'], code=data['sub_type'])
        except AchievementType.DoesNotExist:
            raise serializers.ValidationError({"sub_type": "Неверный подтип для данной категории."})

        # Ищем студента и его пользователя
        try:
            student = Student.objects.select_related('user').get(record_book__iexact=data['record_book'].strip())
            if not student.user:
                raise serializers.ValidationError({"record_book": "К профилю студента не привязан пользователь."})
            data['user'] = student.user
        except Student.DoesNotExist:
            raise serializers.ValidationError({"record_book": "Студент не найден."})

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