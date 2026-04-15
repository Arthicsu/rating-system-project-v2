from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin
from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'patronymic', 'get_roles', 'is_active', 'is_staff', 'is_superuser')
    list_filter = ('is_active', 'is_staff', 'is_superuser', 'groups')
    search_fields = ('username', 'first_name', 'last_name', 'patronymic', 'email')

    fieldsets = UserAdmin.fieldsets + (
        (None, {'fields': ('patronymic',)}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        (None, {'fields': ('patronymic',)}),
    )

    @admin.display(description='Роли')
    def get_roles(self, obj):
        return ', '.join(sorted(obj.groups.values_list('name', flat=True))) or '—'