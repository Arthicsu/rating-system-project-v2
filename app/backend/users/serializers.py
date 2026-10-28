import logging

from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from students.models import Student, DocumentFile
from users.signals import _client_ip
# from users.services import get_pending_docs_count

audit_logger = logging.getLogger('audit')

User = get_user_model()


class DocumentFileAccessSerializer(serializers.ModelSerializer):
    """
    Метаданные файла документа для эндпоинтов скачивания/предпросмотра.

    Сами эндпоинты отдают бинарный поток, поэтому сериализатор не используется для
    тела ответа — он описывает ресурс (`DocumentFile`) для схемы OpenAPI и
    `get_object()`/`get_serializer()` базовой вьюшки.
    """
    id = serializers.UUIDField(source='public_id', read_only=True)
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
    # Сотрудник вуза (есть профиль Staff)
    # Не путать с Django is_staff - тот открывает админку и есть только у суперпользователей
    is_employee = serializers.SerializerMethodField()
    # pending_docs_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'record_book',
            'isAuthenticated',
            'is_employee',
            'notify_review_emails',
            'full_name',
            'short_name',
            'roles',
            # 'pending_docs_count',
        ]

    @extend_schema_field(serializers.BooleanField())
    def get_is_employee(self, obj):
        return hasattr(obj, 'staff_profile')

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
        from .services import register_student

        return register_student(
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            patronymic=validated_data.get('patronymic') or '',
            record_book=validated_data['record_book'],
        )


class ForgotPasswordRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(help_text="Введите ваш email для восстановления пароля")


class ChangePasswordSerializer(serializers.Serializer):
    """
    Смена пароля студентом: текущий пароль и новый, прошедший AUTH_PASSWORD_VALIDATORS.
    Пробелы по краям обрезаются, как у LoginRequestSerializer, - иначе сохранённый пароль
    не совпал бы с тем, что придёт при входе.
    """
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_old_password(self, value):
        request = self.context['request']
        if not request.user.check_password(value):
            # check_password не шлёт user_login_failed - без этой строки подбор из чужой сессии не виден.
            audit_logger.warning(
                "password change failed: wrong current password user=%s ip=%s",
                request.user.pk, _client_ip(request),
            )
            raise serializers.ValidationError("Неверный текущий пароль")
        return value

    def validate(self, attrs):
        new_password = attrs['new_password']
        if new_password == attrs['old_password']:
            raise serializers.ValidationError({'new_password': "Новый пароль совпадает с текущим"})
        try:
            validate_password(new_password, self.context['request'].user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'new_password': list(exc.messages)})
        return attrs


class PastPendingSerializer(serializers.Serializer):
    year_start = serializers.IntegerField(read_only=True)
    label = serializers.CharField(read_only=True)
    count = serializers.IntegerField(read_only=True)


class PendingCountSerializer(serializers.Serializer):
    pending_docs_count = serializers.IntegerField(read_only=True)
    # Нерассмотренные заявки прошлых учебных лет (только у кафедры) - заметка в кабинете.
    past_pending = PastPendingSerializer(many=True, read_only=True)


class NotificationSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ['notify_review_emails']
        extra_kwargs = {'notify_review_emails': {'required': True}}
