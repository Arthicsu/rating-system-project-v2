# Короткие команды dev-среды (project-dev-compose.yml): scripts\dev.ps1 <команда> [аргументы].
# Те же команды, что в scripts/dev.sh. Файл в UTF-8 с BOM: иначе Windows PowerShell 5.1 читает кириллицу как ANSI.
$ErrorActionPreference = 'Stop'
$command = if ($args.Count -gt 0) { $args[0] } else { 'help' }
$rest = @($args | Select-Object -Skip 1)

function dc {
    docker compose -f project-dev-compose.yml @args
    if ($LASTEXITCODE -ne 0) { throw "docker compose $($args -join ' '): код выхода $LASTEXITCODE" }
}

Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    switch ($command) {
        'up' { dc up -d --build @rest }
        'down' { dc down @rest }
        'restart' { dc restart @rest }
        'logs' { dc logs -f --tail=100 @rest }
        'ps' { dc ps @rest }
        'test' { dc exec -u app backend python manage.py test --noinput @rest }
        'manage' { dc exec -u app backend python manage.py @rest }
        'front' { dc exec frontend pnpm @rest }
        'api' {
            dc exec -T -u app backend python manage.py spectacular --file /tmp/schema.yml
            dc cp backend:/tmp/schema.yml app/frontend/schema.yml
            dc exec -T frontend pnpm generate:api
            dc exec -T frontend pnpm check:api-sync
        }
        'db-restore' {
            # up применяет DEV_DB_DUMP из .env (пересоздаёт контейнер db, том с данными остаётся).
            dc up -d --wait db
            dc stop backend celery
            dc exec -T db /docker-entrypoint-initdb.d/10-dev-db-restore.sh --recreate
            # Сессии и кэш в Redis относятся к прежней базе.
            dc exec -T redis sh -c 'export REDISCLI_AUTH=$REDIS_PASSWORD; redis-cli FLUSHALL'
            # backend применяет миграции при старте - дамп старше кода догонит схему.
            dc start backend celery
        }
        'version' {
            # Единственный источник версии - app/frontend/package.json; теги наших образов в compose обязаны совпадать.
            $version = (Get-Content app/frontend/package.json -Raw -Encoding UTF8 | ConvertFrom-Json).version
            Write-Output $version
            $compose = if ($env:VERSION_COMPOSE) { $env:VERSION_COMPOSE } else { 'docker-compose.yml' }
            $bad = @(Select-String -Path $compose -Pattern 'arthicsu/bgitu-rating-[a-z-]*:[^\s"]*' -AllMatches |
                ForEach-Object { $_.Matches.Value } | Where-Object { $_ -notlike "*:$version" })
            if ($bad.Count -gt 0) {
                Write-Output "Теги образов не совпадают с версией ${version}:"
                $bad | Write-Output
                exit 1
            }
        }
        default {
            Write-Output @'
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
'@
        }
    }
}
finally {
    Pop-Location
}
