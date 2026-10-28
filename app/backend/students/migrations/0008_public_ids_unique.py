import uuid

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('students', '0007_add_public_ids'),
    ]

    operations = [
        migrations.AlterField(
            model_name='student',
            name='public_id',
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True, verbose_name='Публичный ID'),
        ),
        migrations.AlterField(
            model_name='document',
            name='public_id',
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True, verbose_name='Публичный ID'),
        ),
        migrations.AlterField(
            model_name='documentfile',
            name='public_id',
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True, verbose_name='Публичный ID'),
        ),
    ]
