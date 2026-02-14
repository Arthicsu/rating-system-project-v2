# BGITU Tracking Student Performance for Scholarships
[![Python Version](https://img.shields.io/badge/python-3.12%2B-red?style=flat-square)]()
[![Django](https://img.shields.io/badge/Django-6.0-green?style=flat-square)]()
[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?style=flat-square)]()
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-blue?style=flat-square)]()
[![Docker](https://img.shields.io/badge/Docker-ready-blue?style=flat-square)]()


## Технологический стек

- **Backend**: Django 6.0 (REST Framework)
- **Frontend**: React 19 + Next.js 16 (App Router)
- **Database**: PostgreSQL 17
- **Storage**: Supabase (S3 Bucket) для хранения подтверждающих достижение документов (позже заменим)
- **DevOps**: Docker + Docker Compose
- **Design**: [Макет в Figma](https://www.figma.com/design/9l33Vfc0J1KDnmRAVFf83a/Student-rating?node-id=0-1&p=f&t=3ykJrEDJjMVUqEgg-0)

---

## Структура проекта
```text
├── app/
│   ├── backend/                    # Django проект: API, модели данных и логика
│   │   ├── students/               # Необходимые модели данных, логика отправки документов
│   │   ├── university_structure/   # Необходимые модели данных, логика одобрения/отклонения документов
│   │   └── users/                  # Кастомная авторизация и профили
│   └── frontend/                   # Next.js приложение: компоненты и контексты
│       ├── app/                    # Маршрутизация (Next.js App Router)
│       ├── components/             # UI-кит проекта (Header, Login, StudentRating)
│       └── context/                # Управление состоянием (AuthContext)
├── docker-compose.yml              # Конфигурация сервисов
└── .env.example                    # Шаблон переменных окружения
```
## Установка и развертывание
- Убедитесь, что у вас установлены Docker.

Клонируйте репозиторий:<br>
```
git clone https://github.com/Arthicsu/BGTU-project--tracking-student-performance-for-scholarships.git
```
- Настройте переменные окружения из .env.example

- Запустите проект:

```
docker-compose up --build
```
После сборки frontend будет доступен на http://localhost:3000, а API backend на http://localhost:8000.

## Требования:
>Python 3.12+

>Node.js 22+

>Docker Engine 29.1+

>PostgreSQL 17


## Документация API

Проект использует **drf-spectacular** для автоматической генерации OpenAPI 3.0 схемы. После запуска бэкенда (порт 8000), документация доступна по следующим адресам:

- **Swagger UI**: [http://localhost:8000/api/schema/swagger-ui/](http://localhost:8000/api/schema/swagger-ui/) — интерактивная консоль для тестирования запросов.
- **Redoc**: [http://localhost:8000/api/schema/redoc/](http://localhost:8000/api/schema/redoc/) — чистая и удобная документация в формате лендинга.
- **OpenAPI Schema (JSON)**: [http://localhost:8000/api/schema/](http://localhost:8000/api/schema/) — сырая схема для импорта в Postman или генерации клиентов.

Для доступа к защищенным методам в Swagger UI используйте кнопку **Authorize** (поддерживается Session Authentication).