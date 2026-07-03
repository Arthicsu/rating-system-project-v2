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

- Python 3.12+
- Node.js 25+
- Docker Engine 29.1+

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
   docker compose exec backend python manage.py setup_roles
   ```
5. Если при развёртывании не используется дамп бд (в .env: HAS_DUMP=false), то необходимо создать суперпользователя:
   ```bash
   docker compose exec backend python manage.py createsuperuser
   ```
   
## Резервное копирование и восстановление

Бэкапы снимает сервис `celery` (worker + встроенный beat) внутри стека - того же образа, что
`backend`. Ежедневно в 03:00 (МСК) задача `core.tasks.backup_all`:

1. `pg_dump` БД → `./backups/db/<POSTGRES_DB>_<YYYYMMDD_HHMMSS>.sql.gz` (plain SQL + gzip);
2. все объекты bucket'а достижений → `./backups/seaweedfs/<bucket>_<...>.tar.gz`
   (ключи `<record_book>/<uuid>.<ext>` сохраняются как есть);
3. ротация - хранятся 3 последних копии каждого вида.

Ручной прогон / проверка планировщика:
```bash
docker compose exec celery celery -A backend call core.tasks.backup_all # разово через очередь
docker compose exec celery celery -A backend inspect registered # видно core.tasks.backup_all
```
Настройки: `BACKUPS_DIR` (по умолчанию `/backups`), `BACKUP_KEEP` (по умолчанию `3`).

### Восстановление БД (заливка дампа обратно)
```bash
gunzip -c backups/db/Project_<YYYYMMDD_HHMMSS>.sql.gz | docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```
Либо распакованный файл положить как `dumps/dump_prod.sql` и развернуть с `HAS_DUMP=true`.

### Восстановление хранилища (например, после потери volume `seaweedfs_data`)
1. Поднять чистый SeaweedFS (bucket создаётся автоматически в `entrypoint.sh`).
2. Залить объекты из архива обратно (по умолчанию берётся самый свежий tar.gz):
```bash
docker compose exec -T celery python -c "import django,os; os.environ.setdefault('DJANGO_SETTINGS_MODULE','backend.settings'); django.setup(); from core.tasks import restore_storage; print('restored', restore_storage())"
```
   Ключи в архиве совпадают с теми, что в `students_documentfile.file`, поэтому ссылки в БД
   снова валидны. Конкретный архив можно передать: `restore_storage('/backups/seaweedfs/<файл>.tar.gz')`.

> Данные SeaweedFS хранятся в одном экземпляре (`replicaPlacement=000`).
> Пересоздание контейнера данные не теряет (они в named volume), но потеря самого volume/диска - теряет.
> нужно off-site копия + rsync

## Документация

К проекту есть документация в постовляемом архиве

## Лицензия

Проект распространяется под лицензией MIT.  
Организация: БГИТУ (Брянский государственный инженерно-технологический университет)
