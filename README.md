# BGITU Tracking Student Performance for Scholarships
[![Python Version](https://img.shields.io/badge/python-3.12%2B-red?style=flat-square)]()
[![Django](https://img.shields.io/badge/Django-6.0-green?style=flat-square)]()
[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?style=flat-square)]()
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-blue?style=flat-square)]()
[![Docker](https://img.shields.io/badge/Docker-ready-blue?style=flat-square)]()


## Технологический стек (dev)

- **Backend**: Django 6.0.2 (REST Framework)
- **Frontend**: React 19 + Next.js 16.1.6 (App Router)
- **Database**: PostgreSQL 17
- **Cache/Sessions**: Redis 8.8.0
- **Storage**: SeaweedFS 4.35 (S3-совместимое хранилище для документов)
- **DevOps**: Docker + Docker Compose
- **Design**: [Макет в Figma](https://www.figma.com/board/9l33Vfc0J1KDnmRAVFf83a/Student-rating)

---

## Поставляемый архив

Для развёртывания системы предоставляется архив со следующей структурой:

```
archive/
├── .env # файл переменных окружения
├── docs/
│   └── *.md, *.pdf # Документация (актуальная на Апрель 2026 (мне лень пока обновлять))
├── dumps/
│   └── dump_dev.sql # Полный дамп БД со структурой и данными
```

## Структура проекта
```text
├── app/
│   ├── backend/                    # Django проект: API, модели данных и логика
│   │   ├── core/                   # Общие утилиты и переиспользуемые компоненты. Подробнее в документации к проекту
│   │   ├── templates/              # Шаблоны расширяющие стандартную Админ-панель Django
│   │   ├── students/               # Приложение, связанное со студентами. Содержит модели данных о студентах, их достижениях, документах.
│   │   ├── university_structure/   # Приложение для управления структурой университета. Содержит модели факультетов, кафедр, направлений подготовки, групп студентов.
│   │   └── users/                  # Кастомная авторизация и профили
│   └── frontend/                   # Next.js приложение
│       ├── app/                    # Маршрутизация (Next.js App Router)
│       ├── components/             # переиспользуемые React-компоненты. Содержит форму входа, кнопку экспорта в эксель и другие UI-элементы (в том числе страницу профиля студента, но так быть не должно)
│       ├── hooks/                  # custom React hooks. На данный момент hook для загрузки файла из хранилища на клиент
│       ├── context/                # Управление состоянием (AuthContext)
│       ├── interfaces/             # Определения структур данных. TypeScript-интерфейсы, описывающие формат данных, приходящих с API
│       └── lib/                    # Содержит Axios для HTTP-запросов к API.
├── dumps/dump_dev.sql              # Дамп БД (dev)
├── project-dev-compose.yml         # Конфигурация сервисов (для dev)
└── .env                            # Файл переменных окружения
└── .env.example                    # Шаблон переменных окружения
```

## Установка и развёртывание для dev

1. Склонируйте dev ветку:
   ```bash
   git clone https://github.com/Arthicsu/rating-system-project-v2/tree/dev
   ```
---
2. Перейдите в директорию с проектом
   ```bash
   cd <путь к папке проекта>
   ```
- Проверьте что в `app\backend\entrypoint.sh` последовательность конца строки LF (не CRLF)

- Проверьте что в `seaweedfs-entrypoint.sh` последовательность конца строки LF (не CRLF)

3. Закиньте из постовляемого архива файл переменных окружения .env в корень проекта
---
4. Создайте в корне проекта папку `dumps`. Закиньте из постовляемого архива файл dev дампа
---
5. Начните собирать контейнеры проекта:
   ```bash
   docker compose -f project-dev-compose.yml up -d --build
   ```
---
6. Контейнеры успешно были собраны и запущены? Проверьте клиент - перейдите на [localhost](http://localhost/).
- Да, компиляция страниц на клиенте очень медленная, так как используется старый сборщик webpack, поддерживающий 
---
7. Данные для тестовых учёток я предоставлю.

## Полезные команды

- Полное удаление контейнеров и чистка всех volume
   ```bash
   docker compose down -v
   ```
- А всё, дальше думайте.

## Документация

К проекту в постовляемом архиве есть документация, которая актуальна на момент Апреля 2026 (по мере возможности будет обновляться)