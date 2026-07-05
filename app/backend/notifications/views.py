from drf_spectacular.utils import extend_schema

from rest_framework import viewsets
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .serializers import PendingCountSerializer


@extend_schema(tags=['notifications'])
class NotificationViewSet(viewsets.ViewSet):
    """Уведомления сотрудника (счётчик заявок, ожидающих действия)."""
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: PendingCountSerializer})
    @action(detail=False, methods=['get'], url_path='pending-count')
    def pending_count(self, request):
        """Число заявок, ожидающих действия текущего сотрудника (0 для не-сотрудников)."""
        return Response(PendingCountSerializer(request.user).data)
