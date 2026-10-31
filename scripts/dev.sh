#!/bin/sh
# Короткие команды dev-среды (project-dev-compose.yml): scripts/dev.sh <команда> [аргументы].
# PowerShell-вариант с теми же командами - scripts/dev.ps1.
set -eu
cd "$(dirname "$0")/.."
# Git Bash на Windows иначе переписывает пути внутри контейнера (/docker-entrypoint-initdb.d/...) в C:/...
export MSYS_NO_PATHCONV=1

dc() { docker compose -f project-dev-compose.yml "$@"; }

cmd="${1:-help}"
[ $# -gt 0 ] && shift

case "$cmd" in
    up) dc up -d --build "$@" ;;
    down) dc down "$@" ;;
    restart) dc restart "$@" ;;
    logs) dc logs -f --tail=100 "$@" ;;
    ps) dc ps "$@" ;;
    test) dc exec -u app backend python manage.py test --noinput "$@" ;;
    manage) dc exec -u app backend python manage.py "$@" ;;
    front) dc exec frontend pnpm "$@" ;;
    api)
        dc exec -T -u app backend python manage.py spectacular --file /tmp/schema.yml
        dc cp backend:/tmp/schema.yml app/frontend/schema.yml
        dc exec -T frontend pnpm generate:api
        dc exec -T frontend pnpm check:api-sync
        ;;
    db-restore)
        # up применяет DEV_DB_DUMP из .env (пересоздаёт контейнер db, том с данными остаётся).
        dc up -d --wait db
        dc stop backend celery
        dc exec -T db /docker-entrypoint-initdb.d/10-dev-db-restore.sh --recreate
        # Сессии и кэш в Redis относятся к прежней базе.
        dc exec -T redis sh -c 'export REDISCLI_AUTH=$REDIS_PASSWORD; redis-cli FLUSHALL'
        # backend применяет миграции при старте - дамп старше кода догонит схему.
        dc start backend celery
        ;;
    version)
        # Единственный источник версии - app/frontend/package.json; теги наших образов в compose обязаны совпадать.
        v=$(grep -m1 '"version"' app/frontend/package.json | sed 's/.*"version": *"\([^"]*\)".*/\1/')
        echo "$v"
        bad=$(grep -o 'arthicsu/bgitu-rating-[a-z-]*:[^[:space:]"]*' "${VERSION_COMPOSE:-docker-compose.yml}" | grep -v ":$v\$" || true)
        if [ -n "$bad" ]; then
            echo "Теги образов не совпадают с версией $v:"
            echo "$bad"
            exit 1
        fi
        ;;
    *)
        cat <<'EOF'
Команды dev-среды (project-dev-compose.yml):
  up [сервис]          собрать и поднять (после смены зависимостей/Dockerfile тоже up)
  down                 остановить и удалить контейнеры (тома с данными остаются)
  restart [сервис]     перезапустить (celery правки кода сам не видит)
  logs [сервис]        логи в реальном времени
  ps                   состояние контейнеров
  test [метки]         тесты бэкенда, например: test students.tests_period
  manage <команда>     manage.py, например: manage setup_roles
  front <скрипт>       pnpm во фронте, например: front typecheck, front lint
  api                  обновить контракт API: schema.yml, lib/api-types.ts и проверка
  db-restore           пересоздать dev-базу из DEV_DB_DUMP (.env) и очистить Redis
  version              версия сайта из package.json и проверка тегов образов в docker-compose.yml
EOF
        ;;
esac
