"""
Периодические бэкапы: дамп БД (gzip) и дамп хранилища достижений
(объекты S3/SeaweedFS -> tar.gz). Пишутся в settings.BACKUPS_DIR (bind-mount ./backups), хранится settings.BACKUP_KEEP последних копий каждого вида.
Задачи можно запускать по отдельности (`backup_db`, `backup_storage`) или разом (`backup_all`- эта идёт в планировщик beat).
"""
import gzip, tarfile, tempfile
import os, logging
import shutil, subprocess
from datetime import datetime
from pathlib import Path

import boto3
from botocore.config import Config as BotoConfig
from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


def _timestamp() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def _rotate(directory: Path, pattern: str, keep: int) -> None:
    """Нужно чтобы ооставить самых свежих файлов по маске, остальные удалить."""
    files = sorted(directory.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
    for old in files[keep:]:
        try:
            old.unlink()
            logger.info("backup rotate: removed %s", old.name)
        except OSError as exc:
            logger.warning("backup rotate: cannot remove %s: %s", old, exc)

def _resolve(base, keep):
    """Дефолты из настроек django settings.py"""
    base = Path(base or settings.BACKUPS_DIR)
    keep = settings.BACKUP_KEEP if keep is None else keep
    return base, keep


def _latest(directory: Path, pattern: str) -> Path:
    files = sorted(directory.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
    if not files:
        raise FileNotFoundError(f"нет файлов по маске {pattern} в {directory}")
    return files[0]

def dump_database(dest_dir: Path, ts: str) -> Path:
    """pg_dump в plain SQL, сжатый gzip.
    После gunzip файл годится как готовый дамп .sql (к примеру, `dumps/dump_prod.sql`) для развёртывания с HAS_DUMP=true.
    """
    db = settings.DATABASES["default"]
    out = dest_dir / f"{db['NAME']}_{ts}.sql.gz"
    cmd = [
        "pg_dump",
        "-h", str(db["HOST"]),
        "-p", str(db["PORT"]),
        "-U", str(db["USER"]),
        "-d", str(db["NAME"]),
        "--no-owner",
        "--no-privileges",
    ]
    env = {**os.environ, "PGPASSWORD": db.get("PASSWORD") or ""}
    logger.info("pg_dump -> %s", out.name)
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
    try:
        with gzip.open(out, "wb") as gz:
            shutil.copyfileobj(proc.stdout, gz)
    finally:
        _, err = proc.communicate()
    if proc.returncode != 0:
        out.unlink(missing_ok=True)
        raise RuntimeError(
            f"pg_dump failed (code {proc.returncode}): "
            f"{err.decode(errors='replace')[:500]}"
        )
    return out


def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.AWS_S3_ENDPOINT_URL,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name="local",
        verify=settings.AWS_S3_VERIFY,
        config=BotoConfig(signature_version="s3v4"),
    )


def tree_dump_storage(dest_dir: Path, ts: str, bucket: str) -> tuple[Path, int]:
    """
    Зеркалит все объекты bucket'а во временное дерево (ключи как есть) и упаковывает в tar.gz.
    Ключи в архиве == S3-ключи (`<record_book>/<uuid>.<ext>`)
    """
    out = dest_dir / f"{bucket}_{ts}.tar.gz"
    s3 = _s3_client()
    count = 0
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=bucket):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                target = tmp_path / key
                target.parent.mkdir(parents=True, exist_ok=True)
                s3.download_file(bucket, key, str(target))
                count += 1
        logger.info("storage: downloaded %d objects from '%s'", count, bucket)
        with tarfile.open(out, "w:gz") as tar:
            for f in sorted(tmp_path.rglob("*")):
                if f.is_file():
                    tar.add(f, arcname=f.relative_to(tmp_path).as_posix())
    return out, count

def restore_storage(archive_path=None, base=None) -> int:
    """
    Заливает объекты из tar.gz-дампа обратно в bucket (ключи = пути в архиве).
    По умолчанию берёт самый свежий архив из <BACKUPS_DIR>/seaweedfs. Возвращает число
    загруженных объектов. 
    Симметрично tree_dump_storage
    """
    base = Path(base or settings.BACKUPS_DIR)
    if archive_path is None:
        archive_path = _latest(base / "seaweedfs", "*.tar.gz")
    archive_path = Path(archive_path)
    bucket = settings.AWS_STORAGE_BUCKET_NAME
    s3 = _s3_client()
    count = 0
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        with tarfile.open(archive_path, "r:gz") as tar:
            tar.extractall(tmp_path)
        for f in sorted(tmp_path.rglob("*")):
            if f.is_file():
                key = f.relative_to(tmp_path).as_posix()
                s3.upload_file(str(f), bucket, key)
                count += 1
    logger.info("restore_storage: uploaded %d objects from %s", count, archive_path.name)
    return count

@shared_task(name="core.tasks.backup_db")
def backup_db(base=None, keep=None) -> dict:
    """Дамп БД + ротация. Можно запускать отдельно."""
    base, keep = _resolve(base, keep)
    db_dir = base / "db"
    db_dir.mkdir(parents=True, exist_ok=True)

    db_file = dump_database(db_dir, _timestamp())
    _rotate(db_dir, "*.sql.gz", keep)

    summary = {"db_dump": db_file.name, "db_size": db_file.stat().st_size}
    logger.info("backup_db done: %s", summary)
    return summary


@shared_task(name="core.tasks.backup_storage")
def backup_storage(base=None, keep=None) -> dict:
    """Дамп хранилища достижений (SeaweedFS bucket) + ротация. Можно запускать отдельно."""
    base, keep = _resolve(base, keep)
    storage_dir = base / "seaweedfs"
    storage_dir.mkdir(parents=True, exist_ok=True)

    storage_file, obj_count = tree_dump_storage(
        storage_dir, _timestamp(), settings.AWS_STORAGE_BUCKET_NAME
    )
    _rotate(storage_dir, "*.tar.gz", keep)

    summary = {
        "storage_dump": storage_file.name,
        "storage_size": storage_file.stat().st_size,
        "objects": obj_count,
    }
    logger.info("backup_storage done: %s", summary)
    return summary


@shared_task(name="core.tasks.backup_all")
def backup_all(base=None, keep=None) -> dict:
    """Полный бэкап (идёт в планировщик): сначала БД, потом хранилище; ротация в обеих папках."""
    base, keep = _resolve(base, keep)
    summary = {**backup_db(base, keep), **backup_storage(base, keep)}
    logger.info("backup_all done: %s", summary)
    return summary
