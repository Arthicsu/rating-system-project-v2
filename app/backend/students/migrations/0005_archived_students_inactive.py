from django.db import migrations


def deactivate_archived_users(apps, schema_editor):
    """Уже архивным студентам закрыть вход, как теперь делает архивация (сотрудников и админов не трогаем)."""
    User = apps.get_model('users', 'User')
    closed = User.objects.filter(
        student_profile__archived_at__isnull=False, staff_profile__isnull=True,
        is_staff=False, is_superuser=False, is_active=True,
    ).update(is_active=False)
    if closed:
        print(f"\n  Закрыт вход архивным студентам: {closed}")


class Migration(migrations.Migration):

    dependencies = [
        ('students', '0004_student_archived_at_alter_student_external_id_and_more'),
        ('university_structure', '0003_staff_users_not_admin'),
        ('users', '0002_user_notify_review_emails'),
    ]

    operations = [
        migrations.RunPython(deactivate_archived_users, migrations.RunPython.noop),
    ]
