"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

# Кастомизация админ панели
admin.site.site_header = "Админ-панель системы рейтинга студентов"  # Заголовок в браузере и шапке
admin.site.site_title = "Админ-панель"                              # Заголовок в браузере

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', RedirectView.as_view(url='/admin/', permanent=False), name='home_redirect'),
    # Все ресурсы API — через DRF router (см. backend/api_urls.py).
    path('api/v1/', include(('backend.api_urls', 'api'))),
]

# Схема API, Swagger/Redoc и browsable-auth  регистрируем их только в dev
if settings.DEBUG:
    urlpatterns += [
        path('api-auth/', include('rest_framework.urls', namespace='rest_framework')),
        # Swagger
        path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
        # Optional UI:
        path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
        path('api/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    ]
