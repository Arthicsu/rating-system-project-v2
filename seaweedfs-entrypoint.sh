#!/bin/sh
set -e

mkdir -p /etc/seaweedfs
# Генерация s3.json
echo '{
  "buckets": [{"name": "'"${AWS_STORAGE_BUCKET_NAME}"'"}],
  "identities": [{
    "name": "admin",
    "credentials": [{
      "accessKey": "'"${AWS_ACCESS_KEY_ID}"'",
      "secretKey": "'"${AWS_SECRET_ACCESS_KEY}"'"
    }],
    "actions": ["Read:PublicAccess", "Write:Delete"]
  }]
}' > /etc/seaweedfs/s3.json

exec /usr/bin/weed server \
  -dir=/data \
  -s3 \
  -s3.config=/etc/seaweedfs/s3.json \
  -master.volumeSizeLimitMB=1024 \
  -filer.defaultReplicaPlacement=000