from students.models import Document


def get_pending_docs_count(user) -> int:
    """
    Возвращает число заявок, ожидающих действия данного сотрудника.

    Логика повторяет правила области видимости (scope):
    - ректорат — все документы со статусом 'approved'
    - декан — 'approved' в рамках своего факультета
    - кафедра — 'pending' в рамках своей кафедры

    Для не-сотрудников (или например сотрудников без привязки) возвращает 0.
    """
    staff = getattr(user, 'staff_profile', None)
    if staff is None:
        return 0

    if getattr(user, 'is_rectorate', False):
        return Document.objects.filter(status__code='approved').count()

    if getattr(user, 'is_dean', False) and staff.faculty_id:
        return Document.objects.filter(
            user__student_profile__faculty_id=staff.faculty_id,
            status__code='approved',
        ).count()

    if getattr(user, 'is_dept_staff', False) and staff.department_id:
        return Document.objects.filter(
            user__student_profile__group__specialty__department_id=staff.department_id,
            status__code='pending',
        ).count()

    return 0
