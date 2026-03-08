from rest_framework import serializers
from .models import Faculty, Department, Specialty, Group, Staff

class FacultySerializer(serializers.ModelSerializer):
    class Meta:
        model = Faculty
        fields = ['id', 'external_id', 'name', 'short_name', 'dean_name', 'phone']

class DepartmentSerializer(serializers.ModelSerializer):
    faculty_name = serializers.CharField(source='faculty.short_name', read_only=True, default="—")

    class Meta:
        model = Department
        fields = ['id', 'external_id', 'name', 'short_name', 'faculty', 'faculty_name', 'head_name']

class SpecialtySerializer(serializers.ModelSerializer):
    faculty_name = serializers.CharField(source='faculty.short_name', read_only=True)
    department_name = serializers.CharField(source='department.short_name', read_only=True)

    class Meta:
        model = Specialty
        fields = [
            'id', 'code_fgos', 'name', 'short_name', 
            'faculty_name', 'department_name', 'qualification'
        ]

class GroupSerializer(serializers.ModelSerializer):
    specialty_name = serializers.CharField(source='specialty.name', read_only=True)
    specialty_code = serializers.CharField(source='specialty.code_fgos', read_only=True)

    class Meta:
        model = Group
        fields = [
            'id', 'name', 'course', 
            'academic_year', 'education_level', 'education_form', 
            'specialty_name', 'specialty_code'
        ]

class StaffSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.get_full_username', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True, default="—")
    faculty_name = serializers.CharField(source='faculty.name', read_only=True, default="—")
    email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = Staff
        fields = ['id', 'full_name', 'email', 'phone', 'department_name', 'faculty_name']