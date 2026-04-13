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
        if not hasattr(user, 'staff_profile'):
            return False
        
        if user.is_rectorate:
            return True
        
        student = getattr(document.user, 'student_profile', None)
        if not student:
            return False
        
        if user.is_dean and student.faculty:
            return student.faculty == user.staff_profile.faculty
        
        if user.is_dept_staff and student.department:
            return student.department == user.staff_profile.department
        
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
