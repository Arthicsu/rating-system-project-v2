from django.urls import path
from . import views

app_name = 'university_structure'

urlpatterns = [
    path('api/v1/document/<int:doc_id>/review/', views.ReviewDocumentAPIView.as_view(), name='api_doc_review'),
    path('api/v1/export-rating-to-excel/', views.RatingExportAPIView.as_view(), name='api_export_rating_to_xlsx'),
]