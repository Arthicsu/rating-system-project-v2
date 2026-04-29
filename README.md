# BGITU Tracking Student Performance for Scholarships
[![Python Version](https://img.shields.io/badge/python-3.12%2B-red?style=flat-square)]()
[![Django](https://img.shields.io/badge/Django-6.0.2-green?style=flat-square)]()
[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?style=flat-square)]()
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-blue?style=flat-square)]()
[![Docker](https://img.shields.io/badge/Docker-ready-blue?style=flat-square)]()


<div align="center">
  <img width="100" alt="BGITU" src="app/frontend/public/media/logo_BGITU.png" />
</div>

## Краткое описание

**BGITU Tracking Student Performance for Scholarships** - система для автоматизации учёта достижений студентов. Студенты формируют цифровое портфолио, преподаватели верифицируют заявки и отслеживают аналитику по баллам.

## Технологический стек

- **Backend**: Django 6.0.2 (REST Framework)
- **Frontend**: React 19 + Next.js 16.1.6 (App Router)
- **Database**: PostgreSQL 17
- **Cache/Sessions**: Redis 8.6.2
- **Storage**: SeaweedFS 4.21 (S3-совместимое хранилище для документов)
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

## Установка и развёртывание для разработки (не prod)

1. Клонируйте репозиторий:
   ```bash
   git clone https://github.com/Arthicsu/rating-system-project-v2.git
   ```

2. Настройте переменные окружения:
   ```bash
   cp .env.example .env
   # Заполните .env (SECRET_KEY, ключи SeaweedFS, PostgreSQL, Redis)
   ```

3. Запустите проект:
   ```bash
   docker compose up -d --build
   ```

4. Первоначальная настройка (после первого запуска):
   ```bash
   docker compose exec backend python manage.py setup_roles
   docker compose exec backend python manage.py createsuperuser
   ```

## Локальная разработка frontend

Для разработки frontend используйте **pnpm**:

```bash
cd app/frontend
pnpm install
pnpm dev
```

## Документация

К проекту есть документация

## Docker-образы

- `arthicsu/bgitu-rating-backend:1.0.0`
- `arthicsu/bgitu-rating-frontend:1.0.0`
- `arthicsu/bgitu-rating-nginx:local-dev`

## Лицензия

Проект распространяется под лицензией MIT.  
Организация: БГИТУ (Брянский государственный инженерно-технологический университет)