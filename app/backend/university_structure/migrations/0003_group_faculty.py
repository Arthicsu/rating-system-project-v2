import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('university_structure', '0002_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='group',
            name='faculty',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='groups',
                to='university_structure.faculty',
                verbose_name='Факультет',
            ),
        ),
    ]
