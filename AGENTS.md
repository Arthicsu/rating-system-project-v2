# AGENTS.md

Django 6.0 + Next.js 16 monorepo for BGITU scholarship scoring.

## Structure
```
app/backend/             Django REST API (Django 6.0.2, DRF)
  backend/              Django project (settings, urls, wsgi)
  core/                Admin mixins, pagination, context processors
  students/            Student CRUD, documents, achievements, scoring
  university_structure/ Faculty/department hierarchy, approval flow
  users/               Custom User model + auth
  config-files/        Scoring config JSON
  entrypoint.sh        Container startup (bucket creation, migrations, server)
app/frontend/          Next.js 16.1.6 (React 19, App Router, Tailwind v4)
```

## Dev Commands
```bash
docker compose up --build
docker compose exec backend python manage.py setup_roles
docker compose exec backend python manage.py createsuperuser

# Frontend (local dev)
cd app/frontend && pnpm dev
cd app/frontend && pnpm lint
```

## Entrypoint Behavior (entrypoint.sh)
- `HAS_DUMP=false` → runs migrations; otherwise skips (DB from volume)
- `USE_GUNICORN=true` → Gunicorn; `false` (default) → Django dev server
- SeaweedFS S3 bucket auto-created on startup
- Static files collected on every container start
- Requires `SEAWEEDFS_ACCESS_KEY`/`SEAWEEDFS_SECRET_KEY`

## Services
| Service   | URL                      | Note |
|-----------|--------------------------|------|
| Nginx     | http://localhost:80       | Primary access |
| Frontend  | http://localhost:3000     | Direct dev |
| API       | http://localhost:8000     | Direct dev |
| Swagger   | http://localhost:8000/api/schema/swagger-ui/ | Use port 8000 |
| SeaweedFS | 8333 (S3), 9333, 8888     | S3 storage |
| Redis     | localhost:6379            | Auth required |

## Database Reset
```bash
docker compose down -v
docker compose up --build
docker compose exec backend python manage.py setup_roles
```

## Settings (app/backend/backend/settings.py)
- `AUTH_USER_MODEL = 'users.User'`
- `SCORING_CONFIG_PATH` = `app/backend/config-files/scoring_json/scoring_config.json`
- Pagination: 20 items (`StandardResultsSetPagination` in `core/pagination.py`)
- Language: Russian (`LANGUAGE_CODE = 'ru'`, `TIME_ZONE = 'Europe/Moscow'`)
- Sessions cached in Redis
- Auth: SessionAuthentication only (not JWT)

## Conventions
- Backend = pip (`requirements.txt`), frontend = `pnpm`
- `DJANGO_SETTINGS_MODULE = 'backend.settings'` (manage.py sets this)
- Storage: SeaweedFS S3 via `boto3` + `django-storages`
- Staff roles: Rectorate (full) > Dean (faculty) > Department (dept)
- `*.sh` files must use LF (CRLF breaks startup)
- Admin imports: `CsvImport`/`JsonImport` mixins in `core/`
- OpenAPI: drf-spectacular at `/api/schema/`
- Tailwind CSS: v4 via `@tailwindcss/postcss` (no `tailwind.config.js`)

## Gaps
- No backend lint/typecheck
- No real tests (stub files only)