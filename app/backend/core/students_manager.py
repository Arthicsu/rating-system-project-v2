from django.db import models

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

    def by_category(self, category):
        """Сортировка в зависимости от категории достижения"""
        if not category or category == 'common':
            return self.order_by('-total_score', 'full_name')

        sort_field = f"{category}_score"
        return self.order_by(f'-{sort_field}', 'full_name')


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