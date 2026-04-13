from django.urls import path
from . import views

app_name = 'user'

urlpatterns = [
    path('api/v1/register/student/', views.RegistrationAPIView.as_view(), name='api_register_student'),
    path('api/v1/login/', views.LoginAPIView.as_view(), name='api_login'),
    path('api/v1/logout/', views.LogoutAPIView.as_view(), name='api_logout'),

    path('api/v1/rating-filters/', views.RatingFiltersAPIView.as_view(), name='api_student_rating_filters'),
    path('api/v1/category-achievements/', views.CategoryAchievementAPIView.as_view(), name='api_category_achievements'),

    path('api/v1/profile/', views.ProfileAPIView.as_view(), name='api_profile'),
    path('api/v1/profile/<int:student_id>/', views.PublicProfileAPIView.as_view(), name='api_student_profile_by_id'),
    path('api/v1/check-auth/', views.CheckAuthAPIView.as_view(), name='api_check_auth'),

    path('api/v2/rating/', views.RatingListAPIView.as_view(), name='api_v2_student_rating'),
]