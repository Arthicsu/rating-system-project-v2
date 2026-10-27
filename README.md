# BGITU Tracking Student Performance for Scholarships
[![Python Version](https://img.shields.io/badge/python-3.12%2B-red?style=flat-square)]()
[![Django](https://img.shields.io/badge/Django-6.0.2-green?style=flat-square)]()
[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?style=flat-square)]()
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-blue?style=flat-square)]()
[![Docker](https://img.shields.io/badge/Docker-ready-blue?style=flat-square)]()


<div align="center">
  <img width="100" alt="BGITU" src="app/frontend/public/media/logo_BGITU.svg" />
</div>

## Краткое описание

**BGITU Tracking Student Performance for Scholarships** - система для автоматизации учёта достижений студентов. Студенты формируют цифровое портфолио, преподаватели верифицируют заявки и отслеживают аналитику по баллам.

## Технологический стек

- **Backend**: Django 6.0.2 (REST Framework)
- **Frontend**: React 19 + Next.js 16.1.6 (App Router)
- **Database**: PostgreSQL 17
- **Cache/Sessions**: Redis 8.8.0
- **Storage**: SeaweedFS 4.35 (S3-совместимое хранилище для документов)
- **DevOps**: Docker + Docker Compose
- **Design**: [Макет в Figma](https://www.figma.com/board/9l33Vfc0J1KDnmRAVFf83a/Student-rating)

## Ключевые особенности

- **Ролевая модель**: личные кабинеты для студентов, панель для преподавателей.
- **Аналитика**: распределение баллов по видам деятельности (учеба, наука, спорт, культура), отслеживание среднего балла группы, формирование выборок студентов.
- **Автоматизированный скоринг**: система начисления баллов на основе настраиваемой конфигурации.
- **Документы**: загрузка и хранение подтверждающих документов (дипломы, грамоты и т.д.).

## Требования

- Docker Engine 29.1+ (Python 3.12 и Node.js 26 приходят в образах, на хосте не нужны)

## Поставляемый архив

Для развёртывания системы предоставляется архив со следующей структурой:

```
archive/
├── admin_panel_csv_students/
│   ├── Students_for_django.csv    # Отфильтрованный список студентов (2025-2026 уч. год)
│   ├── passwords/
│   │   └── students_creds_*.csv # Пароли учётных записей студентов
│   └── scoring_json/
│       └── scoring_config.json        # Конфигурация достижений: категории, подкатегории, уровни, результаты
├── admin_panel_csv_university_structure/
│   ├── staff.csv                # Сотрудники
│   ├── Группы.csv              # Учебные группы
│   ├── Кафедры.csv             # Кафедры
│   ├── Специальность.csv        # Специальности
│   └── Факультеты.csv          # Факультеты
├── docs/
│   └── *.md, *.pdf              # Документация
└── extend/
    ├── Audit_removed_students.csv # Лог удалённых студентов
    ├── Email_Conflicts_Report.csv # Отчёт о конфликтах email
    └── Студенты.csv             # Исходные данные студентов
```

### Использование данных из архива

- **dumps/dump_prod.sql** - содержит полную структуру университета, студентов и достижения. Рекомендуется использовать при первичном развёртывании с HAS_DUMP=true
- **students_creds_*.csv** - пароли студентов для входа в систему
- Если используется `Project_<data>.sql`, то нижеперечисленное загружать не нужно. 
- **admin_panel_csv_*** - используемые CSV-файлы для загрузки данных через админ-панель Django
- **scoring_config.json** - используемая конфигурация баллов за достижения (категории, подкатегории, уровни, результаты)

## Установка и развёртывание для prod

1. Клонируйте репозиторий:
   ```bash
   git clone https://github.com/Arthicsu/rating-system-project-v2.git
   ```

2. Если не используется поставляемый в архиве `.env`, то настройте переменные окружения.
   ```bash
   cp .env.example .env
   # Заполните .env (SECRET_KEY, ключи SeaweedFS, PostgreSQL, Redis и т.д.)
   ```

3. Запустите проект:
   ```bash
   docker compose up -d --build
   ```
4. Если при развёртывании не используется дамп бд (в .env: HAS_DUMP=false), то необходимо создать роли пользователей:
   ```bash
   docker compose exec -u app backend python manage.py setup_roles
   ```
5. Если при развёртывании не используется дамп бд (в .env: HAS_DUMP=false), то необходимо создать суперпользователя:
   ```bash
   docker compose exec -u app backend python manage.py createsuperuser
   ```
   
## Разработка (dev-среда)

Dev-стек описан в `project-dev-compose.yml`: исходники смонтированы в контейнеры, бэкенд работает
на сервере Django с автоперезагрузкой, фронт - на `next dev` с горячей перезагрузкой. Короткие
команды - `scripts/dev.sh` (Git Bash, Linux) и `scripts/dev.ps1` (PowerShell), команды одинаковые:

```bash
scripts/dev.sh up                 # собрать и поднять (и после смены зависимостей/Dockerfile)
scripts/dev.sh test               # тесты бэкенда; можно метку: test students.tests_period
scripts/dev.sh front typecheck    # pnpm во фронте: typecheck, lint, ...
scripts/dev.sh api                # обновить контракт API (schema.yml, lib/api-types.ts) и проверить
scripts/dev.sh db-restore         # пересоздать dev-базу из DEV_DB_DUMP
scripts/dev.sh                    # список всех команд
```

Если PowerShell не даёт запустить скрипт: `powershell -ExecutionPolicy Bypass -File scripts\dev.ps1 up`.

Переменные только для dev - в `.env` с префиксом `DEV_` (прод-compose их не читает):

- `DEV_DB_DUMP` - дамп dev-базы: путь внутри `SHARED_HOST_DIR`, `dumps/<файл>` или `backups/db/<файл>`,
  `.sql` или `.sql.gz` (ежедневный бэкап подходит как есть). Загружается при первом старте пустого
  тома postgres. Сменить дамп у работающей базы: поменять `DEV_DB_DUMP` и выполнить
  `scripts/dev.sh db-restore` - команда **удаляет текущую dev-базу**, загружает дамп, очищает Redis
  (сессии и кэш старой базы) и поднимает backend, который применяет миграции. Файлы достижений в
  SeaweedFS при этом не меняются: для них - `restore_storage` (раздел ниже).
- `DEV_USE_GUNICORN` - `false` (по умолчанию): сервер Django с автоперезагрузкой; `true` - gunicorn, как в проде.
- `DEV_NEXT_BUNDLER` - `webpack` (по умолчанию) видит правки на Windows-хосте; `turbopack` быстрее,
  но подхватывает правки только там, где до контейнера доходят события файлов (Linux, WSL).

Заметки:
- celery правки кода сам не видит - `scripts/dev.sh restart celery`;
- после смены фронтовых зависимостей пересоздать том `node_modules`:
  `docker compose -f project-dev-compose.yml up -d --build --renew-anon-volumes frontend`;
- dev-nginx отдаёт CSP с `'unsafe-eval'` (`app/nginx/security-headers.dev.conf`) - без него webpack-dev
  не работает; прод-образ этого исключения не содержит.

## Резервное копирование и восстановление

Бэкапы снимает сервис `celery` (worker + встроенный beat) внутри стека - того же образа, что
`backend`. Ежедневно в 03:00 (МСК) задача `core.tasks.backup_all`:

1. `pg_dump` БД → `./shared/backups/db/<POSTGRES_DB>_<YYYYMMDD_HHMMSS>.sql.gz` (plain SQL + gzip);
2. все объекты bucket'а достижений → `./shared/backups/seaweedfs/<bucket>_<...>.tar.gz`
   (ключи `<record_book>/<uuid>.<ext>` сохраняются как есть);
3. ротация - хранятся 3 последних копии каждого вида.

Ручной прогон / проверка планировщика:
```bash
docker compose exec -u app celery celery -A backend call core.tasks.backup_all # разово через очередь
docker compose exec -u app celery celery -A backend inspect registered # видно core.tasks.backup_all
```
Настройки: `BACKUPS_DIR` (по умолчанию `/shared/backups`, на хосте - `<SHARED_HOST_DIR>/backups`), `BACKUP_KEEP` (по умолчанию `3`).

### Восстановление БД (заливка дампа обратно)
```bash
gunzip -c shared/backups/db/Project_<YYYYMMDD_HHMMSS>.sql.gz | docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```
Либо распакованный файл положить как `dumps/dump_prod.sql` и развернуть с `HAS_DUMP=true`.

### Восстановление хранилища (например, после потери volume `seaweedfs_data`)
1. Поднять чистый SeaweedFS (bucket создаётся автоматически в `entrypoint.sh`).
2. Залить объекты из архива обратно (по умолчанию берётся самый свежий tar.gz):
```bash
docker compose exec -T -u app celery python -c "import django,os; os.environ.setdefault('DJANGO_SETTINGS_MODULE','backend.settings'); django.setup(); from core.tasks import restore_storage; print('restored', restore_storage())"
```
   Ключи в архиве совпадают с теми, что в `students_documentfile.file`, поэтому ссылки в БД
   снова валидны. Конкретный архив можно передать: `restore_storage('/shared/backups/seaweedfs/<файл>.tar.gz')`.

> Данные SeaweedFS хранятся в одном экземпляре (`replicaPlacement=000`).
> Пересоздание контейнера данные не теряет (они в named volume), но потеря самого volume/диска - теряет.
> нужно off-site копия + rsync

## Права на каталог shared

Каталог `SHARED_HOST_DIR` из `.env` (по умолчанию `./shared`) монтируется в контейнеры backend и celery как `/shared`. Туда приложение пишет логи (`logs/`), бэкапы (`backups/db`, `backups/seaweedfs`), CSV с паролями импорта (`import_passwords/`) и дампы (`dumps/`).

- Процессы приложения работают от непривилегированного пользователя `app` (uid 1000). От root в контейнере выполняется только короткая подготовка при старте (`app/backend/entrypoint.sh`), затем привилегии сбрасываются.
- При каждом старте entrypoint делает владельцем каталога uid 1000 и создаёт эти подкаталоги - даже если `./shared` создал docker или root на хосте.
- В каталоге лежат CSV с паролями и дампы БД: закройте его от других пользователей хоста - `chmod 700 <SHARED_HOST_DIR>` (контейнерам это не мешает).
- Команды в контейнерах backend и celery запускайте от `app`: `docker compose exec -u app ...`. `exec` не проходит через entrypoint и по умолчанию работает от root, а Django от root пишет логи в `/shared/logs`, где приложение может подменить файл ссылкой - и root допишет строку куда угодно.
- Если записать всё равно нельзя, в логе контейнера будет строка `ERR: /shared/... недоступен на запись для uid 1000`. Без записи в `logs/` backend не стартует. Починка на обычном хосте:
   ```bash
   sudo chown -R 1000:1000 <SHARED_HOST_DIR>
   docker compose restart backend celery
   ```
  Сетевой диск с root_squash - то же самое, но на сервере NFS. При rootless docker или userns-remap uid 1000 контейнера на хосте - другой uid (начало диапазона из `/etc/subuid` + 1000): владельцем нужно сделать его.

## Документация

К проекту есть документация в постовляемом архиве

## Лицензия

Проект распространяется под лицензией MIT.  
Организация: БГИТУ (Брянский государственный инженерно-технологический университет)
