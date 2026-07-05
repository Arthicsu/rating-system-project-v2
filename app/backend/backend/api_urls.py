"""
Маршрутизация API v1 через DRF DefaultRouter.

Все ресурсы — ViewSets; reverse-имена в namespace 'api':
api:auth-login, api:students-list, api:achievements-review, ...
"""
from rest_framework.routers import DefaultRouter

from notifications.views import NotificationViewSet
from students.views import AchievementViewSet, StudentViewSet
from university_structure.views import (
    AcademicYearViewSet,
    GroupViewSet,
    RejectionReasonViewSet,
    StaffViewSet,
)
from users.views import AuthViewSet, CategoryViewSet, DocumentFileViewSet, RatingViewSet

router = DefaultRouter()
router.register('auth', AuthViewSet, basename='auth')
router.register('students', StudentViewSet, basename='students')
router.register('achievements', AchievementViewSet, basename='achievements')
router.register('document-files', DocumentFileViewSet, basename='document-files')
router.register('rating', RatingViewSet, basename='rating')
router.register('categories', CategoryViewSet, basename='categories')
router.register('staff', StaffViewSet, basename='staff')
router.register('groups', GroupViewSet, basename='groups')
router.register('rejection-reasons', RejectionReasonViewSet, basename='rejection-reasons')
router.register('academic-years', AcademicYearViewSet, basename='academic-years')
router.register('notifications', NotificationViewSet, basename='notifications')

urlpatterns = router.urls
