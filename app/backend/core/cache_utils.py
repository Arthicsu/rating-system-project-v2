"""
Инвалидация кэша cache_page по key_prefix.

cache_page сам по себе не умеет сбрасываться при изменении данных — только по
TTL. Django-redis даёт delete_pattern, которым мы выметаем и страницы
(`cache_page.<prefix>`), и заголовки (`cache_header.<prefix>`) конкретного
эндпоинта. Вызывается из сигналов на справочниках (см. students/signals.py и
university_structure/signals.py).
"""
import logging

from django.core.cache import cache

logger = logging.getLogger(__name__)


def invalidate_view_cache(*key_prefixes):
    """
    Сбросить кэш cache_page для перечисленных key_prefix.

    На бэкендах без delete_pattern (locmem в тестах) тихо пропускаем —
    там кэш и так изолирован и истекает по TTL.
    """
    delete_pattern = getattr(cache, 'delete_pattern', None)
    if delete_pattern is None:
        return

    for key_prefix in key_prefixes:
        for pattern in (f'*cache_page.{key_prefix}*', f'*cache_header.{key_prefix}*'):
            try:
                delete_pattern(pattern)
            except Exception:
                logger.exception("Не удалось сбросить кэш по префиксу %s", key_prefix)
