"""
Инициализация кэша превью: навешивает lifecycle-экспирацию на префикс
`PREVIEW_CACHE_PREFIX/` в основном бакете, чтобы конвертированные PDF
удалялись автоматически по TTL (ручная чистка не нужна, хранилище не растёт).

Кэш живёт в том же бакете, что и оригиналы, поэтому правило строго ограничено
префиксом - пользовательские файлы (под префиксами зачёток) оно не трогает.

Идемпотентна - вызывается из entrypoint рядом с migrate/collectstatic.
Если версия SeaweedFS не поддерживает lifecycle, команда не падает и фолбэком служит cleanup_preview_cache.
"""
from botocore.exceptions import ClientError
from django.conf import settings
from django.core.management.base import BaseCommand

from core.preview import build_s3_client


class Command(BaseCommand):
    help = "Настраивает TTL-экспирацию (lifecycle) на префикс кэша превью."

    def handle(self, *args, **options):
        bucket = settings.AWS_STORAGE_BUCKET_NAME
        prefix = settings.PREVIEW_CACHE_PREFIX.rstrip('/') + '/'
        ttl_days = settings.PREVIEW_CACHE_TTL_DAYS
        client = build_s3_client()

        try:
            client.put_bucket_lifecycle_configuration(
                Bucket=bucket,
                LifecycleConfiguration={
                    'Rules': [{
                        'ID': 'preview-cache-expiry',
                        'Filter': {'Prefix': prefix},
                        'Status': 'Enabled',
                        'Expiration': {'Days': ttl_days},
                    }],
                },
            )
            # self.stdout.write(self.style.SUCCESS(
            #     f"Lifecycle: '{bucket}/{prefix}' истекает через {ttl_days} дн."
            # ))
        except ClientError as exc:
            # фолбэк - management-команда cleanup_preview_cache.
            self.stdout.write(self.style.WARNING(
                f"Не удалось задать lifecycle для '{bucket}/{prefix}': {exc}. "
                f"Используйте cleanup_preview_cache как фолбэк."
            ))
