from django.urls import path
from . import views

app_name = 'user'

urlpatterns: list = [
    path('api/v1/register/student/', views.RegistrationAPIView.as_view(), name='api_register_student'),
    path('api/v1/login/', views.LoginAPIView.as_view(), name='api_login'),
    path('api/v1/logout/', views.LogoutAPIView.as_view(), name='api_logout'),

    path('api/v1/rating-filters/', views.RatingFiltersAPIView.as_view(), name='api_student_rating_filters'),
    path('api/v1/category-achievements/', views.CategoryAchievementAPIView.as_view(), name='api_category_achievements'),

    path('api/v1/check-auth/', views.CheckAuthAPIView.as_view(), name='api_check_auth'),
    # path('api/v1/csrf/', views.CsrfTokenAPIView.as_view(), name='api_csrf_token'),

    path('api/v1/document/download/<int:file_id>/', views.DocumentDownloadApiView.as_view(), name='api_file_download'),
    path('api/v1/document/preview/<int:file_id>/', views.DocumentPreviewApiView.as_view(), name='api_file_preview'),

    path('api/v2/rating/', views.RatingListAPIView.as_view(), name='api_v2_student_rating'),
    path('api/v1/forgot-password/', views.ForgotPasswordAPIView.as_view(), name='api_forgot_password'),
]