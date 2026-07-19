from django.db import models

# Балльные поля-кэш по кодам категорий (одинаковы на Student и SemesterScore).
# Единый список: скоринг в services.py и защита сортировки от произвольного
# значения `category` из query-параметра.
CATEGORY_SCORE_FIELDS = (
    'academic_score', 'research_score', 'sport_score', 'social_score', 'cultural_score',
)


class StudentQuerySet(models.QuerySet):
    def active(self):
        """
        Только активные (не архивные) студенты — учащиеся и в академ. отпуске.

        Архивные (отчислен/окончил/архив или пропавшие из последней выгрузки) помечены
        `archived_at` и исключаются из «живых» представлений: текущего рейтинга, списков
        групп, дашборда. История баллов (SemesterScore) и файлы при этом сохраняются.
        """
        return self.filter(archived_at__isnull=True)

    def archived(self):
        """Архивные (soft-deleted) студенты — сохранены ради истории баллов и файлов."""
        return self.filter(archived_at__isnull=False)

    def by_category(self, category, direction='desc', prefix=''):
        """
        Сортировка по категории достижения; неизвестная категория (в т.ч. 'common')
        сортирует по общему баллу. `prefix` переключает на аннотации выбранного
        семестра (sem_*), `direction` задаёт направление (asc|desc).
        """
        sort_field = f"{category}_score" if category else ''
        if sort_field not in CATEGORY_SCORE_FIELDS:
            sort_field = 'total_score'

        ordering = f"{prefix}{sort_field}"
        if direction != 'asc':
            ordering = f"-{ordering}"
        return self.order_by(ordering, 'full_name')


class SemesterScoreQuerySet(models.QuerySet):
    def by_category(self, category):
        """
        Сортировка строк SemesterScore (исторический рейтинг за семестр).
        Повторяет логику StudentQuerySet.by_category, но по полям строки семестра.
        """
        if not category or category == 'common':
            return self.order_by('-total_score', 'student__full_name')

        sort_field = f"{category}_score"
        return self.order_by(f'-{sort_field}', 'student__full_name')