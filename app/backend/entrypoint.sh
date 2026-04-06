#!/bin/sh

check_vars() {
  if [ -z "$SEAWEEDFS_ACCESS_KEY" ] || [ -z "$SEAWEEDFS_SECRET_KEY" ]; then
    echo "ERR: SEAWEEDFS_ACCESS_KEY and SEAWEEDFS_SECRET_KEY must be set!"
    exit 1
  fi
}

create_bucket() {
  echo "Ensuring S3 bucket '${SEAWEEDFS_BUCKET_NAME}' exists..."
  python << END
import boto3
import os

s3 = boto3.resource('s3',
    endpoint_url=os.getenv('SEAWEEDFS_ENDPOINT_URL'),
    aws_access_key_id=os.getenv('SEAWEEDFS_ACCESS_KEY'),
    aws_secret_access_key=os.getenv('SEAWEEDFS_SECRET_KEY'),
    region_name='local'
)
bucket_name = os.getenv('SEAWEEDFS_BUCKET_NAME', 'achievement')
bucket = s3.Bucket(bucket_name)

if bucket.creation_date is None:
    print(f"Bucket '{bucket_name}' not found. Creating...")
    bucket.create()
    print(f"Bucket '{bucket_name}' created successfully.")
else:
    print(f"Bucket '{bucket_name}' already exists.")
END
}

check_vars
create_bucket


# echo "Running migrations..."
# python manage.py migrate

# Для Nginx
echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Starting server..."
python manage.py runserver 0.0.0.0:8000