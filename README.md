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
- **Cache/Sessions**: Redis 8.6.3
- **Storage**: SeaweedFS 4.25 (S3-совместимое хранилище для документов)
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
├── .env                          # Основной файл переменных окружения
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
├── dumps/
│   └── dump_prod.sql            # Полный дамп БД со структурой и данными
└── extend/
    ├── Audit_removed_students.csv # Лог удалённых студентов
    ├── Email_Conflicts_Report.csv # Отчёт о конфликтах email
    └── Студенты.csv             # Исходные данные студентов
```

### Использование данных из архива

- **dumps/dump_prod.sql** - содержит полную структуру университета, студентов и достижения. Рекомендуется использовать при первичном развёртывании с HAS_DUMP=true
- **students_creds_*.csv** - пароли студентов для входа в систему
- Если используется `dump_prod.sql`, то нижеперечисленное загружать не нужно. 
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
   
## Документация

К проекту есть документация

## Лицензия

Проект распространяется под лицензией MIT.  
Организация: БГИТУ (Брянский государственный инженерно-технологический университет)
