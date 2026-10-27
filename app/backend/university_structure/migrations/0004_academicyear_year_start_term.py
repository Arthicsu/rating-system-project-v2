from django.db import migrations, models

TERM_LABELS = {'autumn': 'осень', 'spring': 'весна'}


def fill_year_and_term(apps, schema_editor):
    """Учебный год и семестр - из даты начала (с августа - осень этого года, иначе весна прошлого); подписи - заново."""
    AcademicYear = apps.get_model('university_structure', 'AcademicYear')
    seen = {}
    for semester in AcademicYear.objects.order_by('start_date'):
        start = semester.start_date
        year, term = (start.year, 'autumn') if start.month >= 8 else (start.year - 1, 'spring')
        if (year, term) in seen:
            raise RuntimeError(
                f"Периоды «{seen[(year, term)]}» и «{semester.label}» попадают в один семестр "
                f"{year}-{year + 1} ({TERM_LABELS[term]}). Исправьте дату начала или удалите лишний "
                f"период и повторите миграцию."
            )
        seen[(year, term)] = semester.label
        old_label = semester.label
        semester.year_start, semester.term = year, term
        semester.label = f"{year}-{year + 1} уч. год — {TERM_LABELS[term]}"
        semester.save(update_fields=['year_start', 'term', 'label'])
        print(f"\n  «{old_label}» -> «{semester.label}»", end='')


class Migration(migrations.Migration):

    dependencies = [
        ('university_structure', '0003_staff_users_not_admin'),
    ]

    operations = [
        migrations.AddField(
            model_name='academicyear',
            name='year_start',
            field=models.PositiveSmallIntegerField(null=True, verbose_name='Учебный год (год начала)'),
        ),
        migrations.AddField(
            model_name='academicyear',
            name='term',
            field=models.CharField(
                choices=[('autumn', 'осень'), ('spring', 'весна')], max_length=6, null=True, verbose_name='Семестр',
            ),
        ),
        migrations.RunPython(fill_year_and_term, migrations.RunPython.noop),
    ]
