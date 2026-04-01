#!/bin/sh

# Функция для проверки доступности SeaweedFS
wait_for_seaweed() {
  echo "Waiting for SeaweedFS S3 API (seaweedfs:8333)..."
  until python -c "import socket; s = socket.socket(); s.connect(('seaweedfs', 8333))" 2>/dev/null; do
    sleep 1
  done
  echo "SeaweedFS is up and running!"
}

wait_for_seaweed

echo "Ensuring S3 bucket '${SEAWEEDFS_BUCKET_NAME}' exists..."
python << END
import boto3
import os

s3 = boto3.resource('s3',
    endpoint_url=os.getenv('SEAWEEDFS_ENDPOINT_URL', 'http://seaweedfs:8333'),
    aws_access_key_id=os.getenv('SEAWEEDFS_ACCESS_KEY', 'some_access_key'),
    aws_secret_access_key=os.getenv('SEAWEEDFS_SECRET_KEY', 'some_secret_key'),
    region_name='us-east-1'
)
bucket_name = os.getenv('SEAWEEDFS_BUCKET_NAME', 'achievement')
bucket = s3.Bucket(bucket_name)

if bucket.creation_date is None:
    print(f"Bucket '{bucket_name}' not found. Creating...")
    bucket.create()
    # Устанавливаем публичный доступ (policy), если это нужно для раздачи файлов напрямую
    print(f"Bucket '{bucket_name}' created successfully.")
else:
    print(f"Bucket '{bucket_name}' already exists.")
END

echo "Running migrations..."
python manage.py migrate

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Starting server..."
python manage.py runserver 0.0.0.0:8000