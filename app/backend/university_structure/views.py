from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import authentication_classes, permission_classes
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from django.shortcuts import get_object_or_404

from university_structure.models import Faculty, Group
from students.models import Document, Student



class ReviewDocumentAPIView(APIView):
    @authentication_classes([SessionAuthentication])
    @permission_classes([IsAuthenticated])  
    def post(self, request, doc_id):
        if not getattr(request.user, 'is_teacher', False):
             return Response({"error": "Только для преподавателей"}, status=status.HTTP_403_FORBIDDEN)

        doc = get_object_or_404(Document, id=doc_id)
    
        action = request.data.get('action')
        
        if action == 'approve':
            if doc.status == 'approved':
                return Response({"message": "Уже подтверждено"}, status=status.HTTP_200_OK)
            
            doc.status = 'approved'
            doc.save()

            student = doc.student
            points = doc.score
            
            category_map = {
                'academic': 'academic_score',
                'research': 'research_score',
                'sport': 'sport_score',
                'social': 'social_score',
                'cultural': 'cultural_score'
            }
            
            field_name = category_map.get(doc.category)
            if field_name:
                current_score = getattr(student, field_name)
                setattr(student, field_name, current_score + points)
                student.save()
            
            return Response({"message": "Документ подтвержден, баллы начислены"}, status=status.HTTP_200_OK)

        elif action == 'reject':
            reasons = request.data.get('reasons', [])
            reason_text = "; ".join(reasons) if isinstance(reasons, list) else str(reasons)
            
            doc.status = 'rejected'
            doc.rejection_reason = reason_text
            doc.save()
            
            return Response({"message": "Документ отклонен"}, status=status.HTTP_200_OK)

        return Response({"error": "Неверное действие"}, status=status.HTTP_400_BAD_REQUEST)
