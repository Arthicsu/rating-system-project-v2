from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from students.models import Student, Document

User = get_user_model()


class UserResponseSerializer(serializers.ModelSerializer):
    record_book = serializers.CharField(source='student_profile.record_book', read_only=True, default="—")
    isAuthenticated = serializers.BooleanField(default=True)
    full_name = serializers.SerializerMethodField()
    roles = serializers.SerializerMethodField()
    pending_docs_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'record_book',
            'isAuthenticated',
            'is_staff',
            'full_name',
            'roles',
            'pending_docs_count',
        ]

    def get_roles(self, obj):
        return list(obj.groups.values_list('name', flat=True))

    def get_pending_docs_count(self, obj):
        if not hasattr(obj, 'staff_profile'):
            return 0
        staff = obj.staff_profile

        if getattr(obj, 'is_rectorate', False):
            return Document.objects.filter(status__code='approved').count()
        elif getattr(obj, 'is_dean', False) and staff.faculty:
            return Document.objects.filter(
                user__student_profile__faculty=staff.faculty,
                status__code='approved'
            ).count()
        elif getattr(obj, 'is_dept_staff', False) and staff.department:
            return Document.objects.filter(
                user__student_profile__group__specialty__department=staff.department,
                status__code='pending'
            ).count()
        return 0

    def get_full_name(self, obj):
        return obj.get_user_display_name()

class LoginRequestSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

class StudentRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(required=True, write_only=True)
    email = serializers.EmailField(required=True, write_only=True)
    record_book = serializers.CharField(required=True, write_only=True)

    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'patronymic', 
            'email', 'password', 'record_book',
            ]
        extra_kwargs = {'password': {'write_only': True}}

    def validate_record_book(self, value):
        if Student.objects.filter(record_book=value).exists():
            raise serializers.ValidationError("Студент с такой зачеткой уже существует")
        return value

    def validate_email(self, value):
        User = get_user_model()
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Пользователь с таким email уже зарегистрирован.")
        return value

    def create(self, validated_data):
        email = validated_data.pop('email')
        record_book = validated_data.pop('record_book')
        patronymic = validated_data.pop('patronymic', '')
        
        user = User.objects.create_user(
            username=email,
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            patronymic=patronymic,
            email=email,
            password=validated_data['password'],
        )
        
        student_group = Group.objects.get(name='Student')
        user.groups.add(student_group)
        
        Student.objects.create(
            user=user,
            group=None,
            record_book=record_book,
            full_name=user.get_full_name()
        )
        
        return user