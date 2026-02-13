from django.urls import path
from . import views

app_name = 'university_structure'

urlpatterns = [
    path('api/v1/document/<int:doc_id>/review/', views.ReviewDocumentAPIView.as_view()),
]