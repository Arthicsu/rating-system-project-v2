from django.contrib.auth import login, logout, authenticate
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes


from university_structure.models import Faculty, Group
from students.models import Document, Student
from .serializers import StudentRegistrationSerializer
from students.serializers import DocumentSerializer, StudentProfileSerializer, StudentRatingSerializer

User = get_user_model()

def get_student_profile_data(user, request, is_own_profile, is_teacher):
    serializer_context = {'request': request, 'is_own_profile': is_own_profile}
    student_data = StudentProfileSerializer(user.student_profile, context=serializer_context).data
    
    student_data["radar_stats"] = {
        "labels": [
            "Общественная", 
            "Учебная", 
            "Cпорт", 
            "Творческая", 
            "Научная"
        ],
        "data": [
            user.student_profile.social_score,
            user.student_profile.academic_score,
            user.student_profile.sport_score,
            user.student_profile.cultural_score,
            user.student_profile.research_score
        ]
    }
    return student_data

@permission_classes([AllowAny()])  
class RegistrationAPIView(APIView):
    def post(self, request):
        serializer = StudentRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            
            login(request, user)
            
            record_book = None
            if hasattr(user, 'student_profile'):
                record_book = user.student_profile.record_book

            return Response({
                "message": "Регистрация успешна",
                "user_id": user.id,
                "record_book": record_book,
                "isAuthenticated": user.is_authenticated,
                "full_name": user.get_full_username(),
            }, status=status.HTTP_201_CREATED)
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@permission_classes([AllowAny])  
class LoginAPIView(APIView):
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            login(request, user)
            
            record_book = None
            if hasattr(user, 'student_profile'):
                record_book = user.student_profile.record_book

            return Response({
                "message": "Успешный вход",
                "user_id": user.id,
                "record_book": record_book,
                "isAuthenticated": user.is_authenticated,
                "full_name": user.get_full_username(),
            }, status=status.HTTP_200_OK)
        else:
            return Response({"detail": "Неверный логин или пароль"}, status=status.HTTP_401_UNAUTHORIZED)

@permission_classes([AllowAny])  
class CheckAuthAPIView(APIView):
    def get(self, request):
        if request.user.is_authenticated:
            record_book = None
            if hasattr(request.user, 'student_profile'):
                record_book = request.user.student_profile.record_book
            
            return Response({
                "user_id": request.user.id,
                "username": request.user.username,
                "record_book": record_book,
                "isAuthenticated": True,
                "full_name": request.user.get_full_username()
            }, status=status.HTTP_200_OK)
        
        return Response({"isAuthenticated": False}, status=status.HTTP_401_UNAUTHORIZED)

@permission_classes([IsAuthenticated])
@authentication_classes([SessionAuthentication])  
class LogoutAPIView(APIView):
    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_200_OK)

@permission_classes([AllowAny])  
class GroupListView(APIView): 
    def get(self, request):
        groups = Group.objects.all().values('id', 'name', 'course', 'faculty')
        return Response(list(groups))

@permission_classes([AllowAny])  
class RatingAPIView(APIView):
    def get(self, request):
        students = Student.objects.select_related('group', 'faculty').all()
        serializer = StudentRatingSerializer(students, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

# Всё же надо разделить, а то это ужас какой-то 
@permission_classes([IsAuthenticated])
@authentication_classes([SessionAuthentication])  
class PublicProfileAPIView(APIView):
    def get(self, request, user_id=None):
        target_user_id = user_id if user_id else request.user.id
        target_user = get_object_or_404(User, id=target_user_id)
        
        is_own_profile = (request.user.id == target_user.id)
        is_teacher = getattr(request.user, 'is_teacher', False)

        response_data = {
            "id": target_user.id,
            "full_name": target_user.get_full_username(),
            "is_student": target_user.is_student,
            "is_teacher": target_user.is_teacher,
            "is_own_profile": is_own_profile,
        }

        if is_own_profile or is_teacher:
            response_data["email"] = target_user.email
            phone = None
            if hasattr(target_user, 'student_profile'):
                phone = target_user.student_profile.phone
            elif hasattr(target_user, 'teacher_profile'):
                phone = target_user.teacher_profile.phone
            response_data["phone"] = phone

        if target_user.is_student and hasattr(target_user, 'student_profile'):
            student_full_data = get_student_profile_data(target_user, request, is_own_profile, is_teacher)
            response_data.update(student_full_data)

        elif target_user.is_teacher and hasattr(target_user, 'teacher_profile'):
            teacher = target_user.teacher_profile
            
            curated_groups = Group.objects.filter(curator=target_user)
            curated_groups_data = list(curated_groups.values('id', 'name', 'course'))
            
            students_list_data = []
            pending_docs_data = []
            stats = {}

            students_queryset = Student.objects.filter(group__in=curated_groups).select_related('group', 'faculty')
            students_list_data = StudentProfileSerializer(students_queryset, many=True).data
            
            total_students = students_queryset.count()
            avg_score = 0
            if total_students > 0:
                total_sum = sum(s.total_score for s in students_queryset)
                avg_score = round(total_sum / total_students, 1)
            
            stats = {"total_students": total_students, "avg_score": avg_score}

            pending_docs = Document.objects.filter(
                student__in=students_queryset, 
                status='pending'
            ).select_related('student', 'student__group')
            
            for doc in pending_docs:
                doc_data = DocumentSerializer(doc).data
                doc_data['student_id'] = doc.student.id
                doc_data['student_name'] = doc.student.full_name
                doc_data['group_id'] = doc.student.group.id
                doc_data['record_book'] = doc.student.record_book
                pending_docs_data.append(doc_data)

            response_data.update({
                "faculty": teacher.faculty.name if teacher.faculty else "Не указан",
                "position": teacher.position,
                "curated_groups": curated_groups_data,
                "students_list": students_list_data, 
                "pending_documents": pending_docs_data,
                "stats": stats
            })

        return Response(response_data)

@authentication_classes([SessionAuthentication])
class ProfileAPIView(PublicProfileAPIView):
    def get(self, request):
        return super().get(request, user_id=request.user.id)