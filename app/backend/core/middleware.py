"""
Middleware проекта.
"""


class ApiNoStoreMiddleware:
    """
    Ставит `Cache-Control: no-store` всем /api/-ответам, у которых нет явной
    политики кэширования. Ручки с cache_page (rating, categories, config, ...)
    выставляют свой Cache-Control и не затрагиваются.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if request.path.startswith('/api/') and not response.has_header('Cache-Control'):
            response['Cache-Control'] = 'no-store'

        return response
