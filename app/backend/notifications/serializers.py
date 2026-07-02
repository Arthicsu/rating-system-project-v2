from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from django.contrib.auth import get_user_model
from notifications.services import get_pending_docs_count

User = get_user_model()


class PendingCountSerializer(serializers.ModelSerializer):
    pending_docs_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'pending_docs_count',
        ]

    @extend_schema_field(serializers.IntegerField())
    def get_pending_docs_count(self, obj):
        return get_pending_docs_count(obj)