from django.urls import path

from .views import PendingCountAPIView

app_name = 'notifications'

urlpatterns = [
    path('api/v1/notifications/pending-count/', PendingCountAPIView.as_view(), name='pending-count'),
]
