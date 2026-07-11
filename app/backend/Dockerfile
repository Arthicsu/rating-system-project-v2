FROM python:3.12.6-slim-bookworm AS builder
LABEL authors="Arthicsu"

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

COPY requirements.txt .

RUN uv pip install -r requirements.txt --system --no-cache

FROM python:3.12-slim-bookworm

LABEL authors="Arthicsu"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# libpq5 - рантайм для psycopg; postgresql-client-17 - pg_dump для бэкапов
# В bookworm по умолчанию клиент только v15, а pg_dump обязан быть >= версии сервера (17), поэтому ставим клиент 17
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 curl ca-certificates \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
        -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update && apt-get install -y --no-install-recommends postgresql-client-17 \
    && apt-get purge -y --auto-remove curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY requirements.txt .
COPY . .

# Непривилегированный пользователь (uid 1000): контейнер не работает от root.
RUN groupadd --gid 1000 app && useradd --uid 1000 --gid app --create-home app \
    && mkdir -p /backups /dumps /app/logs /app/staticfiles \
    && chown -R app:app /backups /dumps /app/logs /app/staticfiles \
    && chmod +x entrypoint.sh

USER app

EXPOSE 8000

CMD ["./entrypoint.sh"]