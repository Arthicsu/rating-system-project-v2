"""
Периодические задачи приложения students.
"""
from celery import shared_task
from django.utils import timezone


@shared_task
def auto_rollover_semester():
    """
    Автоматический ролловер: если у текущего семестра истёк end_date и есть следующий
    период — завершает текущий и активирует следующий. Идемпотентна: пока семестр не
    закончился или следующего нет, ничего не делает.
    """
    from university_structure.models import AcademicYear
    from students.services import rollover_semester

    current = AcademicYear.get_current()
    if current is None:
        return "no current semester"

    today = timezone.localdate()
    if current.end_date >= today:
        return f"current semester '{current.label}' not ended yet (ends {current.end_date})"

    next_sem = (
        AcademicYear.objects.filter(start_date__gt=current.start_date)
        .order_by('start_date').first()
    )
    if next_sem is None:
        return "no next semester configured"

    result = rollover_semester(to_semester=next_sem)
    return f"rolled over: {result}"
