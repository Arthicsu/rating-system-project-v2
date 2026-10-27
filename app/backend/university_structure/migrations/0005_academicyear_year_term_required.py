from django.db import migrations, models


class Migration(migrations.Migration):
    """Отдельно от заполнения: ALTER таблицы в одной транзакции с обновлением её строк Postgres может отклонить."""

    dependencies = [
        ('university_structure', '0004_academicyear_year_start_term'),
    ]

    operations = [
        migrations.AlterField(
            model_name='academicyear',
            name='year_start',
            field=models.PositiveSmallIntegerField(
                blank=True, help_text='2025 - для 2025-2026 учебного года. Пусто - по дате начала.',
                verbose_name='Учебный год (год начала)',
            ),
        ),
        migrations.AlterField(
            model_name='academicyear',
            name='term',
            field=models.CharField(
                blank=True, choices=[('autumn', 'осень'), ('spring', 'весна')], help_text='Пусто - по дате начала.',
                max_length=6, verbose_name='Семестр',
            ),
        ),
        migrations.AlterField(
            model_name='academicyear',
            name='label',
            field=models.CharField(editable=False, max_length=100, verbose_name='Название периода'),
        ),
        migrations.AlterField(
            model_name='academicyear',
            name='start_date',
            field=models.DateField(
                blank=True, help_text='Пусто - по шаблону: осень с 01.09, весна с 01.02.', verbose_name='Дата начала',
            ),
        ),
        migrations.AlterField(
            model_name='academicyear',
            name='end_date',
            field=models.DateField(
                blank=True, help_text='Пусто - по шаблону: осень по 31.01, весна по 31.08.', verbose_name='Дата окончания',
            ),
        ),
        migrations.AddConstraint(
            model_name='academicyear',
            constraint=models.UniqueConstraint(fields=('year_start', 'term'), name='uniq_academic_year_term'),
        ),
    ]
