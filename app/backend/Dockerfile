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

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY requirements.txt .
COPY . .

RUN mkdir -p /app/logs && chown 777 /app/logs
RUN chmod +x entrypoint.sh

EXPOSE 8000

CMD ["./entrypoint.sh"]