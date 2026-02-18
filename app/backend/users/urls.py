from django.urls import path
from . import views

app_name = 'user'

urlpatterns = [
    path('api/v1/register/student/', views.RegistrationAPIView.as_view(), name='api_register_student'),
    path('api/v1/login/', views.LoginAPIView.as_view(), name='api_login'),
    path('api/v1/logout/', views.LogoutAPIView.as_view(), name='api_logout'),
    path('api/v1/rating/', views.RatingAPIView.as_view(), name='api_student_rating'),
    path('api/v1/profile/', views.ProfileAPIView.as_view(), name='api_profile'),
    path('api/v1/profile/<int:student_id>/', views.PublicProfileAPIView.as_view(), name='api_student_profile_by_id'),
    path('api/v1/check-auth/', views.CheckAuthAPIView.as_view(), name='api_check_auth'),
    path('api/v1/groups/', views.GroupListView.as_view(), name='api_groups'),
]