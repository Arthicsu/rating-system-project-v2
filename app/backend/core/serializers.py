"""Общие сериализаторы ответов для схемы OpenAPI."""
from rest_framework import serializers


class MessageSerializer(serializers.Serializer):
    """Успешный ответ вида {"message": "..."}."""
    message = serializers.CharField()


class ErrorDetailSerializer(serializers.Serializer):
    """Единый формат ошибки API: {"detail": "..."}."""
    detail = serializers.CharField()
