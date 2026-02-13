FROM python:3.12.6-slim-bookworm
LABEL authors="Arthicsu"
ENV PYTHONDONTWRITEBYTECODE=1 \ 
PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

COPY requirements.txt .

RUN uv pip install -r requirements.txt --system

COPY . .
EXPOSE 8000


CMD ["./entrypoint.sh"]