from rest_framework import serializers
from university_structure.models import Faculty
from .models import Student, Document, Category, DocumentFile

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
    student_id = serializers.IntegerField(source='student.id', read_only=True)
    student_name = serializers.CharField(source='student.user.get_full_username', read_only=True)
    group_id = serializers.IntegerField(source='student.group.id', read_only=True)
    record_book = serializers.CharField(source='student.record_book', read_only=True, default="—")

    class Meta(DocumentSerializer.Meta):
        fields = DocumentSerializer.Meta.fields + ['student_id', 'student_name', 'group_id', 'record_book']

class StudentProfileSerializer(serializers.ModelSerializer):
    group = serializers.CharField(source='group.name', read_only=True, default="Без группы")
    group_id = serializers.IntegerField(source='group.id', read_only=True)
    course = serializers.IntegerField(source='group.course', read_only=True)
    faculty = serializers.CharField(source='faculty.short_name', read_only=True, default="—")
    documents = DocumentSerializer(many=True, read_only=True, source='student_documents')
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