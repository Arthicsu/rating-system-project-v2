from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('university_structure', '0003_group_faculty'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='group',
            name='specialty',
        ),
        migrations.DeleteModel(
            name='Specialty',
        ),
    ]
