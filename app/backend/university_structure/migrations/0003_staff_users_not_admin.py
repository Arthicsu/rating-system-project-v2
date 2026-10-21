"""
Сотрудники вуза теряют вход в Django-админку.

Импорт сотрудников ставил User.is_staff=True, а setup_roles давал Dean/Rectorate
права на чтение студентов и заявок - в /admin/ это обходило scope. Админка
остаётся только у суперпользователей ОИ; роли сотрудников работают через API.
"""
from django.db import migrations


def revoke_admin_access(apps, schema_editor):
    User = apps.get_model('users', 'User')
    Group = apps.get_model('auth', 'Group')

    User.objects.filter(staff_profile__isnull=False, is_superuser=False).update(is_staff=False)
    for group in Group.objects.filter(name__in=['Student', 'Department', 'Dean', 'Rectorate']):
        group.permissions.clear()


class Migration(migrations.Migration):

    dependencies = [
        ('university_structure', '0002_initial'),
        ('users', '0001_initial'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        # Обратно не возвращаем: выдавать сотрудникам админку снова не нужно.
        migrations.RunPython(revoke_admin_access, migrations.RunPython.noop),
    ]
