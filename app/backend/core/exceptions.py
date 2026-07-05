"""
Единый формат ошибок API.

Все ошибки отдаются в DRF-нативной форме {"detail": "..."}; ошибки валидации
сериализаторов сохраняют пофилдовую форму {"field": ["msg", ...]}.
Кастомные классы ниже покрывают доменные случаи, которые раньше возвращались
вручную через Response({"error"/"message"}, status=...).
"""
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler as drf_exception_handler


class InvalidCredentials(APIException):
    """
    401 при неверном логине/пароле.

    Намеренно НЕ AuthenticationFailed: его DRF конвертирует в 403 при
    SessionAuthentication (нет WWW-Authenticate), а фронтенд на 403 делает
    жёсткий редирект на /error/403.
    """
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = 'Неверный логин или пароль'
    default_code = 'invalid_credentials'


class FileTooLarge(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Файл слишком большой'
    default_code = 'file_too_large'


class StorageUnavailable(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = 'Хранилище временно недоступно'
    default_code = 'storage_unavailable'


class PreviewBusy(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = 'Сервис предпросмотра занят, повторите позже'
    default_code = 'preview_busy'
    retry_after = 5


class PreviewFailed(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = 'Не удалось сконвертировать документ для предпросмотра'
    default_code = 'preview_failed'


class InvalidDocumentState(APIException):
    """400 при нарушении правил документооборота (например, ревью заявки в неподходящем статусе)."""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Недопустимое действие для текущего статуса заявки'
    default_code = 'invalid_state'


def api_exception_handler(exc, context):
    """
    Обёртка над стандартным DRF-хендлером:
    - проставляет Retry-After, если исключение несёт retry_after (PreviewBusy);
    - заворачивает "голый" список ValidationError в {"detail": [...]},
      чтобы тело ошибки всегда было объектом.
    """
    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    retry_after = getattr(exc, 'retry_after', None)
    if retry_after is not None:
        response['Retry-After'] = str(retry_after)

    if isinstance(response.data, list):
        response.data = {'detail': response.data}

    return response
