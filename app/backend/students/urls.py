from django.urls import path
from . import views

app_name = 'studentProfile'

urlpatterns = [
    path('api/v1/upload/', views.upload_achievement, name='api_upload_achievement'),
    path('api/v1/achievement-config/', views.get_achievement_config, name='api_get_achievement_config')    
]