"""
Идемпотентность мутирующих ручек.

Клиент генерирует UUID на попытку отправки и передаёт его в заголовке
Idempotency-Key; повтор с тем же ключом получает 409. Закрывает дубли при
сетевых сбоях: клиент увидел таймаут, сервер успел создать объект,
пользователь жмёт "отправить" ещё раз.
"""
import functools
import uuid

from django.core.cache import cache
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter
from rest_framework.exceptions import ValidationError

from core.exceptions import DuplicateRequest

# Для extend_schema ручек, обёрнутых в @idempotent.
IDEMPOTENCY_KEY_PARAMETER = OpenApiParameter(
    'Idempotency-Key', OpenApiTypes.UUID, OpenApiParameter.HEADER, required=False,
    description='UUID попытки отправки: повтор с тем же ключом получает 409 вместо дубля.',
)

# Окно "запрос выполняется": параллельный повтор в это время получает 409.
IN_PROGRESS_TTL = 600
# Сутки на "выполнено": окно пользовательских ретраев - минуты, суток с запасом.
DONE_TTL = 60 * 60 * 24


def idempotent(view_method):
    """
    Декоратор action'а ViewSet. Без заголовка поведение прежнее -
    сторонние клиенты (Swagger, тесты) не обязаны слать ключ.
    """
    @functools.wraps(view_method)
    def wrapper(self, request, *args, **kwargs):
        key = request.headers.get('Idempotency-Key')
        if not key:
            return view_method(self, request, *args, **kwargs)

        try:
            uuid.UUID(key)
        except ValueError:
            raise ValidationError({'detail': 'Idempotency-Key должен быть UUID'})

        cache_key = f'idem:{request.user.pk}:{request.path}:{key}'
        # cache.add - это SETNX: ключ занимается атомарно, параллельный
        # повтор (второй клик, ретрай при живом первом запросе) получает 409.
        if not cache.add(cache_key, 'in-progress', timeout=IN_PROGRESS_TTL):
            raise DuplicateRequest()

        try:
            response = view_method(self, request, *args, **kwargs)
        except Exception:
            # Обработчик упал: ключ освобождаем, честный повтор той же
            # отправки после реальной ошибки должен пройти.
            cache.delete(cache_key)
            raise

        if response.status_code < 400:
            cache.set(cache_key, 'done', timeout=DONE_TTL)
        else:
            cache.delete(cache_key)
        return response

    return wrapper
