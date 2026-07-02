from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.generics import GenericAPIView

from .services import get_pending_docs_count
from .serializers import PendingCountSerializer

class PendingCountAPIView(GenericAPIView):
    """
    Отдаёт число заявок, ожидающих действия сотрудника.
    GET — число заявок, ожидающих действия текущего сотрудника.
    Для не-сотрудников возвращает 0. Доступ — только аутентифицированным.
    """
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = PendingCountSerializer
    pagination_class = None
    
    def get(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)
