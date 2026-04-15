from django.urls import path
from . import views

app_name = 'students'

urlpatterns = [
    path('api/v1/upload/', views.AchievementUploadCreateAPIView.as_view(), name='api_upload_achievement'),
    path('api/v1/achievement-config/', views.AchievementConfigAPIView.as_view(), name='api_get_achievement_config'),
    path('api/v1/document/download/<int:file_id>/', views.DocumentDownloadApiView.as_view(), name='api_file_download'),
    path('api/v1/profile/<int:student_id>/', views.StudentProfileAPIView.as_view(), name='api_student_profile_by_id'),
    path('api/v1/profile/', views.StudentProfileAPIView.as_view(), name='api_student_profile'),
]