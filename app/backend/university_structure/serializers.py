from rest_framework import serializers
from .models import Faculty, Department, Specialty, Group, Staff, RejectionReason, AcademicYear

class FacultySerializer(serializers.ModelSerializer):
    """
    Сериализатор для факультета.
    """
    class Meta:
        model = Faculty
        fields = ['id', 'external_id', 'name', 'short_name', 'dean_name', 'phone']

class DepartmentSerializer(serializers.ModelSerializer):
    """
    Сериализатор для кафедры.
    """
    faculty_name = serializers.CharField(source='faculty.short_name', read_only=True, default="—")

    class Meta:
        model = Department
        fields = ['id', 'external_id', 'name', 'short_name', 'faculty', 'faculty_name', 'head_name']

class SpecialtySerializer(serializers.ModelSerializer):
    """
    Сериализатор для специальности.
    """
    faculty_name = serializers.CharField(source='faculty.short_name', read_only=True)
    department_name = serializers.CharField(source='department.short_name', read_only=True)

    class Meta:
        model = Specialty
        fields = [
            'id', 'code_fgos', 'name', 'short_name', 
            'faculty_name', 'department_name', 'qualification'
        ]

class GroupSerializer(serializers.ModelSerializer):
    """
    Сериализатор для групп.
    """
    faculty_name = serializers.CharField(source='specialty.faculty.short_name', read_only=True)    
    specialty_name = serializers.CharField(source='specialty.name', read_only=True)
    specialty_code = serializers.CharField(source='specialty.code_fgos', read_only=True)

    class Meta:
        model = Group
        fields = [
            'id', 'name', 'course', 'faculty_name',
            'academic_year', 'education_level', 'education_form', 
            'specialty_name', 'specialty_code'
        ]

class StaffSerializer(serializers.ModelSerializer):
    """
    Сериализатор сотрудника университета.
    """
    full_name = serializers.CharField(source='user.get_full_username', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True, default="—")
    faculty_name = serializers.CharField(source='faculty.name', read_only=True, default="—")
    email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = Staff
        fields = ['id', 'full_name', 'email', 'phone', 'department_name', 'faculty_name']

class RejectionReasonSerializer(serializers.ModelSerializer):
    """
    Сериализатор причин отклонения заявок.
    """
    class Meta:
        model = RejectionReason
        fields = ['id', 'text']

class AcademicYearSerializer(serializers.ModelSerializer):
    """
    Сериализатор для .
    """
    class Meta:
        model = AcademicYear
        fields = ['id', 'label', 'start_date', 'end_date', 'is_current']

class FacultyFilterSerializer(serializers.ModelSerializer):
    """
    Сериализатор для фильтрации факультетов.
    """
    class Meta:
        model = Faculty
        fields = ['id', 'short_name', 'name']

class CourseFilterSerializer(serializers.Serializer):
    """
    Сериализатор для фильтрации курсов.
    """
    course = serializers.IntegerField()

class GroupFilterSerializer(serializers.ModelSerializer):
    """
    Сериализатор для фильтрации групп.
    """
    faculty_id = serializers.IntegerField(source='specialty.faculty.id', read_only=True)
    faculty_name = serializers.CharField(source='specialty.faculty.short_name', read_only=True)
    
    class Meta:
        model = Group
        fields = ['id', 'name', 'course', 'faculty_id', 'faculty_name', 'academic_year']

class RatingFiltersResponseSerializer(serializers.Serializer):
    """
    Сериализатор фильтра рейтинга для модерации документа.
    """
    faculties = FacultyFilterSerializer(many=True, read_only=True)
    courses = serializers.ListField(child=serializers.IntegerField(), read_only=True)
    groups = GroupFilterSerializer(many=True, read_only=True)

class ReviewDocumentRequestSerializer(serializers.Serializer):
    """
    Сериализатор для модерации документа.
    """
    action = serializers.ChoiceField(choices=['approve', 'reject'])
    reasons = serializers.ListField(child=serializers.CharField(), required=False, help_text="Список причин при отклонении")


class StaffProfileResponseSerializer(serializers.Serializer):
    """
    Сериализатор ответа профиля сотрудника.
    """
    id = serializers.IntegerField()
    full_name = serializers.CharField()
    email = serializers.EmailField()
    phone = serializers.CharField(allow_null=True)
    department_name = serializers.CharField()
    faculty_name = serializers.CharField()
    roles = serializers.ListField(child=serializers.CharField())
    is_own_profile = serializers.BooleanField()
    is_staff = serializers.BooleanField()
    type = serializers.CharField()


class ReviewDocumentResponseSerializer(serializers.Serializer):
    """
    Сериализатор ответа при модерации документа.
    """
    message = serializers.CharField()


class ReviewDocumentErrorSerializer(serializers.Serializer):
    """
    Сериализатор ошибки при модерации документа.
    """
    error = serializers.CharField()