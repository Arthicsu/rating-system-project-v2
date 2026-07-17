#!/bin/sh
# Root-прелюдия: контейнер стартует от root только ради владельца томов,
# затем привилегии сбрасываются до app (uid 1000) без возврата.
#
# Зачем: named volume static_files шарится с nginx, и владельца пустого тома
# задаёт тот контейнер, который первым его инициализировал (а в dev том
# и вовсе наследует root:root от хостового каталога под bind mount).
# Из-за этого collectstatic от uid 1000 падал с PermissionError в зависимости
# от порядка запуска. chown при старте делает владение детерминированным.
set -e

if [ "$(id -u)" = "0" ]; then
    for d in /app/staticfiles /app/logs /backups /dumps; do
        [ -d "$d" ] || continue
        # chown может не сработать на bind mount (Windows dev) или read-only
        # rootfs (celery в прод-compose) - там права и так не мешают работе.
        chown app:app "$d" 2>/dev/null || echo "WARN: владелец $d не сменён"
        find "$d" ! -user app -exec chown app:app {} + 2>/dev/null || true
    done
    export HOME=/home/app
    exec setpriv --reuid=app --regid=app --init-groups "$@"
fi

# Если контейнер запущен уже не от root (например, user: в compose) -
# просто выполняем команду.
exec "$@"
