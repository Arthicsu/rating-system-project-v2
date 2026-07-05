"""
Сигналы приложения university_structure: инвалидация cache_page-кэшей
справочников при изменении данных (иначе они живут только по TTL).
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from core.cache_utils import invalidate_view_cache
from .models import AcademicYear, Faculty, Group, RejectionReason


@receiver(post_save, sender=RejectionReason)
@receiver(post_delete, sender=RejectionReason)
def invalidate_rejection_reasons_cache(sender, **kwargs):
    invalidate_view_cache('rejection-reasons')


@receiver(post_save, sender=AcademicYear)
@receiver(post_delete, sender=AcademicYear)
def invalidate_academic_years_cache(sender, **kwargs):
    # Срабатывает и при ролловере семестра (переключение is_current).
    invalidate_view_cache('academic-years')


@receiver(post_save, sender=Faculty)
@receiver(post_delete, sender=Faculty)
@receiver(post_save, sender=Group)
@receiver(post_delete, sender=Group)
def invalidate_group_filters_cache(sender, **kwargs):
    invalidate_view_cache('rating-filters', 'groups')
