"""
Ручки ЭОС: имя -> (path, unwrap_key, needs_auth)
unwrap_key=None -> ответ используется как есть (голый массив либо {"data": ...})
needs_auth=True -> к запросу добавляется
Можно применить токен EOS_AUTH_TOKEN (не выдавали)
base_url + этого конфига, без правки методов и синхронизаторов. Переопределяется через settings.EOS_ENDPOINTS.
допускаются кортежи из 2 или 3 элементов
"""
import requests
from django.conf import settings
from tenacity import retry, stop_after_attempt, wait_fixed, retry_if_exception_type

DEFAULT_ENDPOINTS = {
    "faculties": ("faculties", None, False),
    "departments": ("Kafs", "listKafs", False),
    "groups": ("GroupsList", "listGroups", False),
    "form_study": ("ListFormStudy", "listFormStudy", False),
    "students": ("students/list", True),
}


class EOSResponseError(Exception):
    """Ответ ЭОС не соответствует ожидаемому формату (state != 1 или нет нужного ключа)"""


class EOSClient:
    def __init__(self, base_url=None, timeout=20, token=None):
        self.base_url = (base_url or getattr(settings, "EOS_BASE_URL", "")).rstrip("/")
        self.endpoints = {**DEFAULT_ENDPOINTS, **getattr(settings, "EOS_ENDPOINTS", {})}
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            "Accept": "application/json",
            "User-Agent": "portfolio.bgiru.ru-eos-sync/1.0",
        })
        self.token = token or getattr(settings, "EOS_AUTH_TOKEN", "")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_fixed(2),
        retry=retry_if_exception_type(requests.RequestException),
        reraise=True,
    )
    def _get(self, path, auth=False):
        url = f"{self.base_url}/{path.lstrip('/')}"
        headers = {"Authorization": f"bearer {self.token}"} if (auth and self.token) else None
        resp = self.session.get(url, timeout=self.timeout, headers=headers)
        resp.raise_for_status()
        return resp.json()

    @staticmethod
    def _unwrap(payload, key=None):
        # /faculties - голый массив; остальные - {"data": {...}, "state": 1}
        if isinstance(payload, list):
            data = payload
        else:
            state = payload.get("state")
            if state not in (None, 1):
                raise EOSResponseError(payload.get("msg") or f"ЭОС вернул state={state}")
            data = payload.get("data", payload)
        if key is not None:
            if not isinstance(data, dict) or key not in data:
                raise EOSResponseError(f"В ответе ЭОС нет ключа '{key}'")
            return data[key]
        return data

    def _fetch(self, name):
        """
        Единая точка запроса: (path, unwrap_key, needs_auth) берём из DEFAULT_ENDPOINTS.
        Допускаем кортежи из 2 или 3 элементов
        """
        conf = self.endpoints[name]
        path, key = conf[0], conf[1]
        auth = conf[2] if len(conf) > 2 else False
        return self._unwrap(self._get(path, auth), key)

    def get_faculties(self):
        """Список факультетов"""
        return self._fetch("faculties")

    def get_departments(self):
        """Список кафедр с полными полями"""
        return self._fetch("departments")

    def get_groups(self):
        """список всех групп текущего учебного года"""
        return self._fetch("groups")

    def get_form_study(self):
        """Справочник форм обучения: [{name, id}] - для декодирования education_form."""
        return self._fetch("form_study")

    def get_students(self):
        """Список студентов (нетестированная заглушка)"""
        return self._fetch("students")
