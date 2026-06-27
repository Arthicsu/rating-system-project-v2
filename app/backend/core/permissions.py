from rest_framework import permissions

class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Разрешение на уровне объекта, позволяющее редактировать объект только его владельцам.
    Предполагается, что экземпляр модели имеет атрибут `owner`.
    """

    def has_object_permission(self, request, view, obj):
        # Разрешения на чтение разрешены для любого запроса,
        # поэтому мы всегда будем разрешать запросы GET, HEAD или OPTIONS.
        if request.method in permissions.SAFE_METHODS:
            return True

        # Экземпляр должен иметь атрибут с именем `owner`.
        return obj.owner == request.user

class IsStaffProfile(permissions.BasePermission):
    """
    Разрешает доступ только аутентифицированным пользователям с профилем сотрудника
    """

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and hasattr(user, 'staff_profile'))