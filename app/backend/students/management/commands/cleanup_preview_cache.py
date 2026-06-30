"""
Фолбэк-очистка кэша превью: удаляет объекты старше TTL из префикса кэша.

Нужна, только если lifecycle-экспирация SeaweedFS не сработала (см. init_preview_cache).
Запускается вручную или по расписанию (может позже надо полноценный планировщик сделать).
Ограничена префиксом кэша - оригиналы документов не затрагиваются.
"""
from datetime import datetime, timedelta, timezone

from django.conf import settings
from django.core.management.base import BaseCommand

from core.preview import build_s3_client


class Command(BaseCommand):
    help = "Удаляет объекты префикса кэша превью старше TTL (фолбэк к lifecycle)."

    def add_arguments(self, parser):
        parser.add_argument(
            '--days', type=int, default=settings.PREVIEW_CACHE_TTL_DAYS, help="Возраст объектов в днях, после которого они удаляются.",
        )

    def handle(self, *args, **options):
        bucket = settings.AWS_STORAGE_BUCKET_NAME
        prefix = settings.PREVIEW_CACHE_PREFIX.rstrip('/') + '/'
        cutoff = datetime.now(timezone.utc) - timedelta(days=options['days'])
        client = build_s3_client()

        paginator = client.get_paginator('list_objects_v2')
        deleted = 0
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            stale = [
                {'Key': obj['Key']}
                for obj in page.get('Contents', [])
                if obj['LastModified'] < cutoff
            ]
            if stale:
                client.delete_objects(Bucket=bucket, Delete={'Objects': stale})
                deleted += len(stale)

        # self.stdout.write(self.style.SUCCESS(
        #     f"Очистка кэша '{bucket}/{prefix}': удалено объектов - {deleted}."
        # ))
