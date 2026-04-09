from django.urls import path
from . import views

app_name = 'university_structure'

urlpatterns = [
    path('api/v1/document/<int:doc_id>/review/', views.ReviewDocumentAPIView.as_view(), name='api_doc_review'),
    path('api/v1/export-rating-to-excel/', views.RatingExportAPIView.as_view(), name='api_export_rating_to_xlsx'),
    path('api/v1/rejection-reasons/', views.RejectionReasonListView.as_view(), name='api_rejection_reasons'),
    path('api/v1/academic-years/', views.AcademicYearListView.as_view(), name='api_academic_years'),
    path('api/v1/filtered-groups/', views.FilteredGroupListAPIView.as_view(), name='api_filtered_groups'),
    path('api/v1/filtered-students/', views.FilteredStudentListAPIView.as_view(), name='api_filtered_students'),
    path('api/v1/filtered-dashboard-stats', views.FilteredDashboardStatsAPIView.as_view(), name='api_filtered_dashboard_stats'),
]