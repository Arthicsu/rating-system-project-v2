from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.urls import reverse
from django.utils.html import format_html

from university_structure.models import Staff

from .models import User


class StaffInline(admin.StackedInline):
    """Профиль сотрудника (Staff) прямо на странице пользователя."""
    model = Staff
    extra = 0
    fields = ('email', 'department', 'faculty', 'phone')
    raw_id_fields = ('department', 'faculty')


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'last_name', 'first_name', 'patronymic', 'get_roles', 'is_active', 'is_staff', 'is_superuser', 'get_student_profile', 'get_staff_profile')
    list_filter = ('is_active', 'is_staff', 'is_superuser', 'groups')
    search_fields = ('username', 'last_name', 'first_name', 'patronymic', 'email')
    inlines = [StaffInline]

    fieldsets = UserAdmin.fieldsets + (
        ('Дополнительно', {'fields': ('patronymic',)}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        (None, {'fields': ('patronymic',)}),
    )

    def get_inlines(self, request, obj=None):
        # На форме создания инлайна нет: сначала сохраняется учётка.
        return [] if obj is None else super().get_inlines(request, obj)

    def get_queryset(self, request):
        # Колонки-ссылки на профили читают связи в списке — без select_related это N+1.
        return super().get_queryset(request).select_related('student_profile', 'staff_profile')

    @admin.display(description='Роли')
    def get_roles(self, obj):
        return ', '.join(sorted(obj.groups.values_list('name', flat=True))) or '—'

    @admin.display(description='Студент')
    def get_student_profile(self, obj):
        student = getattr(obj, 'student_profile', None)
        if student is None:
            return '—'
        url = reverse('admin:students_student_change', args=[student.pk])
        return format_html("<a href='{}'>{}</a>", url, student.full_name)

    @admin.display(description='Сотрудник')
    def get_staff_profile(self, obj):
        staff = getattr(obj, 'staff_profile', None)
        if staff is None:
            return '—'
        url = reverse('admin:university_structure_staff_change', args=[staff.pk])
        return format_html("<a href='{}'>{}</a>", url, obj.get_user_display_name())
