from django.db import models

class StudentQuerySet(models.QuerySet):
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