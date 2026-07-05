from rest_framework import permissions

from core import scoping


class IsStaffProfile(permissions.BasePermission):
    """
    Разрешает доступ только аутентифицированным пользователям с профилем сотрудника
    """

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and hasattr(user, 'staff_profile'))


class IsStudent(permissions.BasePermission):
    """Разрешает доступ только пользователям с профилем студента."""

    message = 'Для этого действия необходима учетная запись студента.'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and hasattr(user, 'student_profile'))


class HasStudentScope(permissions.BasePermission):
    """
    Объектная проверка для Student: доступ к своему профилю либо к студенту
    в области видимости сотрудника (Ректорат > Декан > Кафедра).
    """

    message = 'Доступ запрещён'

    def has_object_permission(self, request, view, obj):
        if obj.user_id and obj.user_id == request.user.id:
            return True
        return scoping.student_in_scope(request.user, obj)


class CanAccessDocumentFile(permissions.BasePermission):
    """
    Объектная проверка для DocumentFile: владелец файла или сотрудник,
    в чью область видимости попадает студент-владелец.
    """

    message = 'У вас нет прав на доступ к этому файлу'

    def has_object_permission(self, request, view, obj):
        return scoping.can_access_document_file(request.user, obj)


class CanReviewDocument(permissions.BasePermission):
    """
    Модерация заявки: только сотрудник, и только если документ находится
    в его области модерации.
    """

    message = 'Документ находится за пределами вашей области модерации'

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and hasattr(user, 'staff_profile'))

    def has_object_permission(self, request, view, obj):
        return scoping.document_in_scope(request.user, obj)


class IsAchievementOwnerOrStaffInScope(permissions.BasePermission):
    """
    Просмотр карточки достижения: владелец заявки либо сотрудник в пределах
    своей области видимости.
    """

    message = 'Доступ запрещён'

    def has_object_permission(self, request, view, obj):
        if obj.user_id == request.user.id:
            return True
        return scoping.document_in_scope(request.user, obj)
