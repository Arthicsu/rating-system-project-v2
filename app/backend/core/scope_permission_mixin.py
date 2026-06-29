from django.shortcuts import get_object_or_404
from students.models import Document
from rest_framework import status
from rest_framework.response import Response


class ScopePermissionMixin:
    """
    Миксин для проверки scope пользователя при модерировании документов.
    
    Используется в APIView для проверки, находится ли документ в области
    видимости текущего пользователя (факультет/кафедра).
    """
    
    def check_staff_scope(self, user, document) -> bool:
        """
        Проверяет, имеет ли пользователь права на модерацию документа.
        Возвращает True, если документ принадлежит области видимости пользователя.
        """
        student = getattr(document.user, 'student_profile', None)
        return self.check_student_scope(user, student)

    def check_student_scope(self, user, student) -> bool:
        """
        Проверяет, попадает ли студент в область видимости (scope) сотрудника.

        Базис совпадает с подсчётом заявок и выборками дашборда:
        - Ректорат — видит всех;
        - Декан    — студентов своего факультета (`student.faculty`);
        - Кафедра  — студентов своей кафедры (`student.department`).
        """
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
            return bool(student.department_id) and student.department_id == staff.department_id

        return False
    
    def get_document_with_scope_check(self, user, doc_id):
        """
        Получает документ и проверяет scope. Возвращает (документ, ошибка_или_None).
        """
        
        doc = get_object_or_404(
            Document.objects.select_related(
                'status', 'category', 
                'user__student_profile', 
                'user__student_profile__faculty', 
                'user__student_profile__department'
            ),
            id=doc_id
        )
        
        if not self.check_staff_scope(user, doc):
            return None, Response(
                {"error": "Документ находится за пределами вашей области модерации"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return doc, None
