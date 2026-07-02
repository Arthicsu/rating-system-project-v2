"""
Celery-приложение проекта.
Брокер - существующий Redis (см. CELERY_BROKER_URL в settings, отдельный logical DB /1)
Один воркер обслуживает и периодические задачи (бэкапы через beat), и отправка письма при восстановлении пароля, ничего не блокируя
"""
import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

celery_app = Celery("backend")

# Все настройки берём из django settings по префиксу CELERY_*.
celery_app.config_from_object("django.conf:settings", namespace="CELERY")

# Задачи из установленных приложений...
celery_app.autodiscover_tasks()
# ...и из пакета `core` - он не в INSTALLED_APPS, поэтому указываем явно (core/tasks.py).
celery_app.autodiscover_tasks(["core"])
