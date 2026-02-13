from rest_framework import serializers
from django.contrib.auth import get_user_model
from students.models import Student

User = get_user_model()

class StudentRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(required=True, write_only=True)
    email = serializers.EmailField(required=True, write_only=True)
    # group_id = serializers.IntegerField(required=False, allow_null=True)
    # record_book = serializers.CharField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'patronymic', 
            'email', 'password',
            ]

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
        patronymic = validated_data.pop('patronymic', '')
        
        user = User.objects.create_user(
            username=email,
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            patronymic=patronymic,
            email=email,
            password=validated_data['password'],
            is_student=True,
            is_teacher=False
        )
        Student.objects.create(
            user=user,
            group=None,
            record_book=None,
            full_name=f"{user.last_name} {user.first_name} {patronymic}".strip()
        )
        
        return user