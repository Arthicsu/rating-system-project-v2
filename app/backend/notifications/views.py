from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import get_pending_docs_count


class PendingCountAPIView(APIView):
    """
    Отдаёт число заявок, ожидающих действия сотрудника.
    GET — число заявок, ожидающих действия текущего сотрудника.
    Для не-сотрудников возвращает 0. Доступ — только аутентифицированным.
    """
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({'pending_docs_count': get_pending_docs_count(request.user)})
