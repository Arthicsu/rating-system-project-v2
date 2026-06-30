"""
Серверная конвертация офисных документов в PDF для предпросмотра.

Логика вынесена из вьюхи, чтобы держать HTTP-слой тонким:
- конвертация офисных файлов (.doc/.docx) в PDF через Gotenberg (Docker-based API for converting documents to PDF, sidecar над LibreOffice);
- кэш готовых PDF в отдельном бакете SeaweedFS с TTL (lifecycle на бакете);
- single-flight на одинаковые файлы и семафор параллельных конвертаций на Redis, чтобы тяжёлая конвертация не завалила бэк.

Django/HTTP-объекты тут не используются (кроме storage), вьюха сама строит ответы.
"""
import logging
import time
from contextlib import contextmanager

import boto3
import requests
from django.conf import settings
from django.core.files.base import ContentFile
from django_redis import get_redis_connection
from storages.backends.s3boto3 import S3Boto3Storage

logger = logging.getLogger(__name__)

# Расширения, которые конвертируем в PDF.
OFFICE_EXTENSIONS = {'.doc', '.docx'}

# Ключи Redis.
_LOCK_KEY = "preview:lock:{file_id}"
_CONCURRENCY_KEY = "preview:concurrency"


class PreviewBusyError(Exception):
    """Слотов для конвертации сейчас нет - клиенту стоит повторить позже."""


class PreviewConversionError(Exception):
    """Конвертер недоступен или вернул ошибку."""


class PreviewCacheStorage(S3Boto3Storage):
    """
    Хранилище кэша конвертированных PDF.

    Лежит в основном бакете под отдельным префиксом `PREVIEW_CACHE_PREFIX`,
    а не в отдельном бакете. Причина: в SeaweedFS каждый бакет - это отдельная
    collection, под которую на одно-узловой инсталляции не удаётся вырастить
    volume ("Not enough data nodes found"). Префикс же живёт в уже рабочей
    коллекции основного бакета. TTL навешивается lifecycle'ом на этот префикс
    (management-команда init_preview_cache), чистка префикса - cleanup_preview_cache.
    """
    bucket_name = settings.AWS_STORAGE_BUCKET_NAME
    location = settings.PREVIEW_CACHE_PREFIX
    default_acl = 'private'
    # Ключ кэша стабилен (id файла), переписывание поверх
    file_overwrite = True
    querystring_auth = True


# Медленная инициализация, чтобы импорт модуля не лез в сеть/настройки раньше времени.
_cache_storage = None


def get_cache_storage() -> PreviewCacheStorage:
    global _cache_storage
    if _cache_storage is None:
        _cache_storage = PreviewCacheStorage()
    return _cache_storage


def cache_key(file_id: int) -> str:
    """Имя объекта в бакете кэша. Контент DocumentFile иммутабелен (uuid-имя)."""
    return f"{file_id}.pdf"


def build_s3_client():
    """boto3-клиент S3 для bucket-операций (создание, lifecycle, очистка)."""
    return boto3.client(
        's3',
        endpoint_url=settings.AWS_S3_ENDPOINT_URL,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name='local',
        verify=settings.AWS_S3_VERIFY,
    )


def is_office_file(file_name: str) -> bool:
    name = (file_name or '').lower()
    return any(name.endswith(ext) for ext in OFFICE_EXTENSIONS)


def cached_pdf_exists(file_id: int) -> bool:
    try:
        return get_cache_storage().exists(cache_key(file_id))
    except Exception:
        logger.exception("Ошибка проверки кэша превью для файла %s", file_id)
        return False


def open_cached_pdf(file_id: int):
    """Возвращает файловый объект PDF из кэша (читается лениво из SeaweedFS)."""
    return get_cache_storage().open(cache_key(file_id), 'rb')


def store_cached_pdf(file_id: int, pdf_bytes: bytes) -> None:
    try:
        get_cache_storage().save(cache_key(file_id), ContentFile(pdf_bytes))
    except Exception:
        # недоступность кэша не должна ронять предпросмотр.
        logger.exception("Не удалось сохранить PDF превью в кэш для файла %s", file_id)


def wait_for_cached_pdf(file_id: int, timeout: int) -> bool:
    """Дожидается появления PDF в кэше (для не-лидера single-flight)."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if cached_pdf_exists(file_id):
            return True
        time.sleep(0.3)
    return False

@contextmanager
def single_flight(file_id: int, ttl: int):
    """
    Лидер конвертации захватывает лок и держит его на время конвертации.
    yield True - мы лидер, конвертируем;
    yield False - кто-то уже конвертирует этот файл, надо ждать кэш.
    """
    conn = get_redis_connection("default")
    key = _LOCK_KEY.format(file_id=file_id)
    acquired = conn.set(key, b"1", nx=True, ex=ttl)
    try:
        yield bool(acquired)
    finally:
        if acquired:
            conn.delete(key)


@contextmanager
def concurrency_slot(limit: int, ttl: int):
    """
    Глобальный семафор числа одновременных конвертаций.
    yield True  - слот занят, можно конвертировать;
    yield False - лимит исчерпан (PreviewBusyError на стороне вызова).

    Счётчик самовосстанавливается: на ключ ставится TTL, поэтому «утёкший»
    из-за падения воркера слот не блокирует систему навсегда.
    """
    conn = get_redis_connection("default")
    current = conn.incr(_CONCURRENCY_KEY)
    conn.expire(_CONCURRENCY_KEY, ttl)
    if current > limit:
        conn.decr(_CONCURRENCY_KEY)
        yield False
        return
    try:
        yield True
    finally:
        if conn.decr(_CONCURRENCY_KEY) < 0:
            conn.set(_CONCURRENCY_KEY, 0)


def convert_office_to_pdf(file_bytes: bytes, filename: str) -> bytes:
    """
    Конвертирует офисный документ в PDF через Gotenberg.
    Поднимает PreviewConversionError при недоступности/ошибке конвертера.
    """
    url = f"{settings.GOTENBERG_URL.rstrip('/')}/forms/libreoffice/convert"
    files = {'files': (filename, file_bytes, 'application/octet-stream')}
    try:
        resp = requests.post(url, files=files, timeout=settings.GOTENBERG_TIMEOUT)
        resp.raise_for_status()
    except requests.exceptions.RequestException as exc:
        logger.exception("Ошибка конвертации '%s' через Gotenberg", filename)
        raise PreviewConversionError(str(exc)) from exc
    return resp.content


def render_office_pdf(file_obj):
    """
    Возвращает файловый объект PDF для офисного документа (из кэша или после конвертации).

    Поднимает PreviewBusyError, если все слоты конвертации заняты,
    и PreviewConversionError при ошибке конвертера.
    """
    file_id = file_obj.id

    # 1. Быстрый путь - готовый PDF уже в кэше.
    if cached_pdf_exists(file_id):
        return open_cached_pdf(file_id)

    lock_ttl = settings.GOTENBERG_TIMEOUT + 10

    # 2. Single-flight: одновременно конвертирует только один воркер на файл.
    with single_flight(file_id, lock_ttl) as is_leader:
        if not is_leader:
            # Другой воркер уже конвертирует - ждём появления PDF в кэше.
            if wait_for_cached_pdf(file_id, settings.GOTENBERG_TIMEOUT):
                return open_cached_pdf(file_id)
            raise PreviewBusyError()

        # Перепроверяем кэш - могли успеть записать, пока брали лок.
        if cached_pdf_exists(file_id):
            return open_cached_pdf(file_id)

        # 3. Семафор общего числа конвертаций.
        with concurrency_slot(settings.PREVIEW_MAX_CONCURRENCY, settings.GOTENBERG_TIMEOUT * 2) as slot:
            if not slot:
                raise PreviewBusyError()

            with file_obj.file.open('rb') as f:
                file_bytes = f.read()

            pdf_bytes = convert_office_to_pdf(file_bytes, file_obj.original_file_name)
            store_cached_pdf(file_id, pdf_bytes)
            return ContentFile(pdf_bytes)
