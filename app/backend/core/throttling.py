from rest_framework.throttling import SimpleRateThrottle


class LoginRateThrottle(SimpleRateThrottle):
    """
    Троттлинг входа по имени пользователя, а не по ip.
    """
    scope = 'login'

    def get_cache_key(self, request, view):
        username = request.data.get('username')
        # без username throttle не применяем и тем самым сериализатор вернёт 400.
        if not username:
            return None
        return self.cache_format % {
            'scope': self.scope,
            'ident': username.strip().lower(),
        }
