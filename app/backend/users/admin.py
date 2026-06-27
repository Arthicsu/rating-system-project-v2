from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin
from django.utils.html import format_html
from .models import User


class StaffInline(admin.StackedInline):
    model = User
    extra = 0
    fields = ('is_staff', 'is_active', 'groups')
    readonly_fields = ('username', 'email', 'last_name', 'first_name', 'patronymic')


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'last_name', 'first_name', 'patronymic', 'get_roles', 'is_active', 'is_staff', 'is_superuser', 'get_student_profile', 'get_staff_profile')
    list_filter = ('is_active', 'is_staff', 'is_superuser', 'groups')
    search_fields = ('username', 'last_name', 'first_name', 'patronymic', 'email')

    fieldsets = UserAdmin.fieldsets + (
        ('Дополнительно', {'fields': ('patronymic',)}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        (None, {'fields': ('patronymic',)}),
    )

    @admin.display(description='Роли')
    def get_roles(self, obj):
        return ', '.join(sorted(obj.groups.values_list('name', flat=True))) or '—'

    @admin.display(description='Студент')
    def get_student_profile(self, obj):
        try:
            student = obj if not obj.is_staff else None
            if student:
                return format_html("<a href='/admin/users/user/{}/'>{}</a>", student.id, student.last_name + ' ' + student.first_name + ' ' + student.patronymic)
            else:
                return '—'
        except Exception:
            return '—'

    @admin.display(description='Сотрудник')
    def get_staff_profile(self, obj):
        try:
            attr = {k: str(v) for k, v in obj.__dict__.items()}
            print(attr)
            staff = obj if obj.is_staff else None
            if staff:
                if staff.first_name in ["Кафедра", "Ректорат", ""]:
                    return format_html("<a href='/admin/users/user/{}/'>{}</a>", staff.id, staff.username)
                else:
                    return format_html("<a href='/admin/users/user/{}/'>{}</a>", staff.id, staff.last_name + ' ' + staff.first_name + (' ' + staff.patronymic) if staff.patronymic else '')
            else:
                return '—'
        except Exception:
            return '—'