from django.urls import path
from . import views

app_name = 'students'

urlpatterns = [
    path('api/v1/upload/', views.AchievementUploadView.as_view(), name='api_upload_achievement'),
    path('api/v1/achievement-config/', views.get_achievement_config, name='api_get_achievement_config')    
]