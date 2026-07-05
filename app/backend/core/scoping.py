"""
Единый источник логики области видимости (scope) сотрудника.

Иерархия ролей:
- Ректорат — видит всех студентов;
- Декан — студентов своего факультета (student.faculty);
- Сотрудник кафедры — студентов своей кафедры (student.group.specialty.department).

Эти функции используются и permission-классами (объектные проверки),
и построением querysets (фильтрация списков).
"""


def student_in_scope(user, student) -> bool:
    """Попадает ли студент в область видимости сотрудника."""
    if not hasattr(user, 'staff_profile'):
        return False

    if user.is_rectorate:
        return True

    if student is None:
        return False

    staff = user.staff_profile

    if user.is_dean:
        return bool(student.faculty_id) and student.faculty_id == staff.faculty_id

    if user.is_dept_staff:
        department_id = None
        if student.group_id and student.group.specialty_id:
            department_id = student.group.specialty.department_id
        return bool(department_id) and department_id == staff.department_id

    return False


def document_in_scope(user, document) -> bool:
    """Находится ли документ (заявка) в области модерации сотрудника."""
    student = getattr(document.user, 'student_profile', None)
    return student_in_scope(user, student)


def can_access_document_file(user, file_obj) -> bool:
    """
    Доступ к файлу документа (скачивание/предпросмотр).

    Владелец файла всегда имеет доступ; сотрудник — только в пределах своей
    области видимости (а не к любому файлу вуза).
    """
    if user.id == file_obj.document.user_id:
        return True
    student = getattr(file_obj.document.user, 'student_profile', None)
    return student_in_scope(user, student)


def scope_queryset(user, queryset, faculty_field='faculty', dept_field='group__specialty__department'):
    """
    Ограничить queryset областью видимости сотрудника.

    Поля переопределяются, чтобы работать и со Student, и с Group
    (например faculty_field='specialty__faculty').
    """
    if user.is_rectorate:
        return queryset

    if hasattr(user, 'staff_profile'):
        if user.is_dean:
            return queryset.filter(**{faculty_field: user.staff_profile.faculty})
        if user.is_dept_staff:
            return queryset.filter(**{dept_field: user.staff_profile.department})

    return queryset.none()
