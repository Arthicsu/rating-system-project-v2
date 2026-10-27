from django.conf import settings
from django.urls import reverse
from django.utils import timezone


def site_urls(request):
    return {
        'EXTERNAL_SITE_URL': getattr(settings, 'EXTERNAL_SITE_URL', '/'),
        'API_SCHEMA_URL': getattr(settings, 'API_SCHEMA_URL'),
    }


def semester_status(request):
    """
    Плашка на страницах админки для суперпользователя: учебный год закончился (по датам его
    последнего семестра) - пора выполнить переход; или текущий период не задан.
    """
    if not request.path.startswith('/admin/') or not getattr(request.user, 'is_superuser', False):
        return {}
    from university_structure.models import AcademicYear

    current = AcademicYear.get_current()
    if current is None:
        return {'semester_warning': "Текущий период не задан: отметьте текущий семестр в «Учебных периодах»."}
    days = (timezone.localdate() - AcademicYear.year_semesters(current.year_start).last().end_date).days
    if days <= 0:
        return {}
    return {
        'semester_warning': (
            f"Учебный год «{current.year_start}-{current.year_start + 1}» закончился {days} дн. назад - "
            f"выполните переход на следующий учебный год."
        ),
        'semester_transition_url': reverse('admin:academic_year_transition'),
    }
