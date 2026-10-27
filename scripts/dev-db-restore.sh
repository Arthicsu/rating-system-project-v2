#!/bin/sh
# Загрузка dev-дампа в базу POSTGRES_DB. Выполняется внутри контейнера db (project-dev-compose.yml).
# DEV_DB_DUMP - путь к дампу внутри SHARED_HOST_DIR: dumps/<файл> или backups/db/<файл>, .sql или .sql.gz.
#  - без аргументов - как скрипт docker-entrypoint-initdb.d: при первом старте пустого тома postgres
#    (база уже создана); без DEV_DB_DUMP база остаётся пустой, схему создадут миграции бэкенда;
#  - с --recreate (scripts/dev db-restore) - пересоздаёт базу и загружает дамп заново.
set -eu
# Битый .gz не должен давать «успешную» загрузку половины дампа.
set -o pipefail

recreate=false
[ "${1:-}" = "--recreate" ] && recreate=true

if [ -z "${DEV_DB_DUMP:-}" ]; then
    if $recreate; then
        echo "ERR: DEV_DB_DUMP не задан в .env - нечего восстанавливать." >&2
        exit 1
    fi
    echo "DEV_DB_DUMP не задан: база создаётся пустой."
    exit 0
fi

dump="/${DEV_DB_DUMP#/}"
case "$dump" in
    /dumps/*|/backups/db/*) ;;
    *)
        echo "ERR: DEV_DB_DUMP должен начинаться с dumps/ или backups/db/ (сейчас: $DEV_DB_DUMP)." >&2
        exit 1
        ;;
esac
# Отсутствующий файл docker подменил бы пустым каталогом - поэтому проверка именно на файл.
if [ ! -f "$dump" ]; then
    echo "ERR: файл дампа SHARED_HOST_DIR/$DEV_DB_DUMP не найден (или это каталог)." >&2
    exit 1
fi

if $recreate; then
    psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d postgres \
        -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\" WITH (FORCE)" \
        -c "CREATE DATABASE \"$POSTGRES_DB\""
fi

echo "Загрузка $DEV_DB_DUMP в базу $POSTGRES_DB..."
# stdout psql - строки set_config/setval из дампа; ошибки идут в stderr и видны.
case "$dump" in
    *.gz) gunzip -c "$dump" ;;
    *) cat "$dump" ;;
esac | psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" > /dev/null
echo "Дамп загружен: $DEV_DB_DUMP."
