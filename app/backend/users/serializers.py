from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from students.models import Student, DocumentFile
from notifications.services import get_pending_docs_count

User = get_user_model()


class DocumentFileAccessSerializer(serializers.ModelSerializer):
    """
    Метаданные файла документа для эндпоинтов скачивания/предпросмотра.

    Сами эндпоинты отдают бинарный поток, поэтому сериализатор не используется для
    тела ответа — он описывает ресурс (`DocumentFile`) для схемы OpenAPI и
    `get_object()`/`get_serializer()` базовой вьюшки.
    """
    size = serializers.SerializerMethodField()

    class Meta:
        model = DocumentFile
        fields = ['id', 'original_file_name', 'size', 'uploaded_at']
        read_only_fields = fields

    @extend_schema_field(serializers.IntegerField())
    def get_size(self, obj):
        try:
            return obj.file.size
        except Exception:
            return None


class UserResponseSerializer(serializers.ModelSerializer):
    record_book = serializers.CharField(source='student_profile.record_book', read_only=True, default="—")
    isAuthenticated = serializers.BooleanField(default=True)
    full_name = serializers.SerializerMethodField()
    short_name = serializers.SerializerMethodField()
    roles = serializers.SerializerMethodField()
    # pending_docs_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'record_book',
            'isAuthenticated',
            'is_staff',
            'full_name',
            'short_name',
            'roles',
            # 'pending_docs_count',
        ]

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_roles(self, obj):
        return list(obj.groups.values_list('name', flat=True))

    # @extend_schema_field(serializers.IntegerField())
    # def get_pending_docs_count(self, obj):
    #     return get_pending_docs_count(obj)

    @extend_schema_field(serializers.CharField())
    def get_full_name(self, obj):
        return obj.get_user_display_name()

    @extend_schema_field(serializers.CharField())
    def get_short_name(self, obj):
        return obj.get_user_display_short_name()

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
            # external_id=None,
            group=None,
            record_book=record_book,
            full_name=user.get_full_name()
        )
        
        return user