from rest_framework import serializers
from university_structure.models import Faculty
from students.models import Student

from .models import Document

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

class DocumentSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    sub_type_display = serializers.CharField(source='get_sub_type_display', read_only=True)
    level_display = serializers.CharField(source='get_level_display', read_only=True)
    result_display = serializers.CharField(source='get_result_display', read_only=True)
    doc_type_display = serializers.CharField(source='get_doc_type_display', read_only=True)

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
            'status',
            'doc_type', 'doc_type_display', 
            'file_url', 
            'original_file_name', 'uploaded_at',
        ]

class StudentProfileSerializer(serializers.ModelSerializer):
    group = serializers.CharField(source='group.name', read_only=True, default="Без группы")
    group_id = serializers.CharField(source='group.id', read_only=True)
    course = serializers.IntegerField(source='group.course', read_only=True)
    faculty = serializers.CharField(source='faculty.short_name', read_only=True, default="—")
    documents = DocumentSerializer(many=True, read_only=True, source='student_documents')
    total_score = serializers.ReadOnlyField()

    class Meta:
        model = Student
        fields = [
            'id', 'user_id', 
            'full_name', 'phone', 'record_book', 
            'group', 'group_id', 'course', 'faculty',
            'academic_score', 'research_score', 'sport_score', 'social_score', 'cultural_score', 'total_score',
            'documents',
        ]