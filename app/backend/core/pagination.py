from rest_framework.pagination import PageNumberPagination

class LargeResultsSetPagination(PageNumberPagination):
    page_size = 1000
    page_size_query_param = 'page_size'
    max_page_size = 10000

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

    def get_page_number(self, request, paginator):
        # Страница за пределами списка (одобрили последнюю карточку на последней странице,
        # старая ссылка) - последняя существующая вместо 404; клиент сверяется по полю page.
        number = super().get_page_number(request, paginator)
        try:
            if int(number) > paginator.num_pages:
                return paginator.num_pages
        except (TypeError, ValueError):
            pass  # 'last' и мусор разбирает сам DRF (404 «Неправильная страница»)
        return number

    def get_paginated_response(self, data):
        response = super().get_paginated_response(data)
        response.data['page'] = self.page.number
        return response

    def get_paginated_response_schema(self, schema):
        schema = super().get_paginated_response_schema(schema)
        schema['properties']['page'] = {'type': 'integer', 'example': 2, 'description': 'Номер отданной страницы'}
        schema['required'].append('page')
        return schema
