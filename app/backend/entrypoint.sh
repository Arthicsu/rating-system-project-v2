#!/bin/sh
# Root-прелюдия: контейнер стартует от root только ради владельца томов,
# затем привилегии сбрасываются до app (uid 1000) без возврата.
#
# Зачем: named volume static_files шарится с nginx, и владельца пустого тома
# задаёт тот контейнер, который первым его инициализировал (а в dev том
# и вовсе наследует root:root от хостового каталога под bind mount).
# Из-за этого collectstatic от uid 1000 падал с PermissionError в зависимости
# от порядка запуска. chown при старте делает владение детерминированным.
#
# То же для общего каталога /shared (bind mount ${SHARED_HOST_DIR}): если его
# создал docker или root на хосте, uid 1000 не мог писать туда логи, бэкапы и CSV -
# Django падал уже на настройке логов.
set -e

# Путь задан жёстко, не из окружения: compose всегда монтирует сюда, а опечатка
# вроде SHARED_DIR=/ отдала бы app весь контейнер.
SHARED=/shared
# Подкаталоги, куда пишет приложение (settings.py: логи, бэкапы, пароли импорта, дампы).
SHARED_SUBDIRS="logs backups/db backups/seaweedfs import_passwords dumps"

as_app() {
    setpriv --reuid=app --regid=app --init-groups "$@"
}

if [ "$(id -u)" = "0" ]; then
    for d in /app/staticfiles "$SHARED"; do
        [ -d "$d" ] || continue
        # chown может не сработать на bind mount (Windows dev) или read-only
        # rootfs (celery в прод-compose) - там права и так не мешают работе.
        # -R обходит каталоги по дескрипторам, -h не разыменовывает ссылки: app
        # между перезапусками может подложить симлинк или подменить каталог
        # посреди пути, и root не должен отдать ему чужой файл (например, /etc/passwd).
        chown -Rh app:app "$d" 2>/dev/null || echo "WARN: владелец $d (или части файлов в нём) не сменён"
    done
    # Подкаталоги создаёт и проверяет уже app: root не ходит по путям, которые app
    # может подменить. Если писать нельзя (том только для чтения, NFS с root_squash,
    # rootless docker) - в логе причина и подсказка; контейнер не валим, решает приложение.
    for sub in $SHARED_SUBDIRS; do
        { as_app mkdir -p "$SHARED/$sub" && as_app test -w "$SHARED/$sub"; } 2>/dev/null \
            || echo "ERR: $SHARED/$sub недоступен на запись для uid 1000 - на хосте выполните: sudo chown -R 1000:1000 <SHARED_HOST_DIR> (подробнее: README, «Права на каталог shared»)"
    done
    export HOME=/home/app
    exec setpriv --reuid=app --regid=app --init-groups "$@"
fi

# Если контейнер запущен уже не от root (например, user: в compose) -
# просто выполняем команду.
exec "$@"
