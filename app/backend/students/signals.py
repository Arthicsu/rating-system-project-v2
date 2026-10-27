"""
Сигналы приложения students.

При ЛЮБОЙ смене текущего семестра (сохранение/удаление AcademicYear — в т.ч. ручное
переключение is_current в админке) пересобираем живой кэш баллов студентов из SemesterScore
нового текущего семестра. Это держит инвариант «живой кэш = баллы текущего семестра» и не
даёт баллам разных семестров наслаиваться.

Во время rollover_semester автосинхронизация подавляется (см. suspend_cache_sync) — там кэш
пересобирается один раз в конце.
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from core.cache_utils import invalidate_view_cache
from university_structure.models import AcademicYear
from students.models import AchievementResult, AchievementType, Category, DocType, Level, ScoringRule
from students.services import rebuild_current_semester_cache, is_cache_sync_suspended


@receiver(post_save, sender=AcademicYear)
@receiver(post_delete, sender=AcademicYear)
def resync_cache_on_semester_change(sender, **kwargs):
    if is_cache_sync_suspended():
        return
    rebuild_current_semester_cache()


@receiver(post_save, sender=Category)
@receiver(post_delete, sender=Category)
@receiver(post_save, sender=AchievementType)
@receiver(post_delete, sender=AchievementType)
@receiver(post_save, sender=ScoringRule)
@receiver(post_delete, sender=ScoringRule)
@receiver(post_save, sender=Level)
@receiver(post_delete, sender=Level)
@receiver(post_save, sender=AchievementResult)
@receiver(post_delete, sender=AchievementResult)
@receiver(post_save, sender=DocType)
@receiver(post_delete, sender=DocType)
def invalidate_achievement_config_cache(sender, **kwargs):
    """
    Справочники конфигурации достижений закэшированы cache_page'ом
    (achv-config, categories) — сбрасываем кэш при любом их изменении.
    """
    invalidate_view_cache('achv-config', 'categories')
