import uuid

from django.db import migrations, models


def fill_public_ids(apps, schema_editor):
    # Каждой строке свой UUID: AddField с default=uuid4 дал бы всем существующим строкам один.
    for name in ('Student', 'Document', 'DocumentFile'):
        model = apps.get_model('students', name)
        rows = list(model.objects.only('pk'))
        for row in rows:
            row.public_id = uuid.uuid4()
        model.objects.bulk_update(rows, ['public_id'], batch_size=1000)


class Migration(migrations.Migration):
    """Поле public_id (пока nullable) и заполнение; unique и NOT NULL - в 0008, отдельной транзакцией."""

    dependencies = [
        ('students', '0006_document_files_purged_at'),
    ]

    operations = [
        migrations.AddField(
            model_name='student',
            name='public_id',
            field=models.UUIDField(editable=False, null=True, verbose_name='Публичный ID'),
        ),
        migrations.AddField(
            model_name='document',
            name='public_id',
            field=models.UUIDField(editable=False, null=True, verbose_name='Публичный ID'),
        ),
        migrations.AddField(
            model_name='documentfile',
            name='public_id',
            field=models.UUIDField(editable=False, null=True, verbose_name='Публичный ID'),
        ),
        migrations.RunPython(fill_public_ids, migrations.RunPython.noop),
    ]
