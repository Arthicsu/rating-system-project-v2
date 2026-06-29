import requests
from django.conf import settings
from tenacity import retry, stop_after_attempt, wait_fixed, retry_if_exception_type


class EOSResponseError(Exception):
    """Ответ ЭОС не соответствует ожидаемому формату (state != 1 или нет нужного ключа)"""


class EOSClient:
    def __init__(self, base_url=None, timeout=20, token=None):
        self.base_url = getattr(settings, "EOS_BASE_URL", DEFAULT_BASE_URL)).rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            "Accept": "application/json",
            "User-Agent": "portfolio.bgiru.ru-eos-sync/1.0",
        })
        # попробуем bearer authToken
        token = token or getattr(settings, "EOS_AUTH_TOKEN", "")
        if token:
            self.session.headers["Authorization"] = f"Bearer {token}"

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_fixed(2),
        retry=retry_if_exception_type(requests.RequestException),
        reraise=True,
    )
    def _get(self, path):
        url = f"{self.base_url}/{path.lstrip('/')}"
        resp = self.session.get(url, timeout=self.timeout)
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

    def get_faculties(self):
        """Список факультетов"""
        return self._unwrap(self._get("faculties"))

    def get_departments(self):
        """Список кафедр с полными полями"""
        return self._unwrap(self._get("Kafs"), "listKafs")

    def get_groups(self):
        """список всех групп текущего учебного года"""
        return self._unwrap(self._get("GroupsList"), "listGroups")

    def get_form_study(self):
        """Справочник форм обучения: [{name, id}] - для декодирования education_form."""
        return self._unwrap(self._get("ListFormStudy"), "listFormStudy")
    # далее гадание какая же структура
    def get_students(self):
        """Список студентов (нужен авторизованный аккаунт / EOS_AUTH_TOKEN).
        Форма элемента совпадает с UserInfo/Student, предположительно обёрнута в data.listStudents.
        Экспериментально: точная структура неизвестна, поля берутся защитно через .get()."""
        return self._unwrap(self._get("students/list"), "listStudents")
