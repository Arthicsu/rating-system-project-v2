from django.conf import settings


def site_urls(request):
    return {
        'EXTERNAL_SITE_URL': getattr(settings, 'EXTERNAL_SITE_URL', '/'),
        'API_SCHEMA_URL': getattr(settings, 'API_SCHEMA_URL', '/api/schema/swagger-ui/'),
    }
