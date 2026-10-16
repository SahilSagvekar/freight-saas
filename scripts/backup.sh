#!/usr/bin/env bash
# Encrypted Postgres backup. Used by the nightly workflow and runnable by hand.
#   BACKUP_DATABASE_URL  connection string to dump (required)
#   BACKUP_PASSPHRASE    encrypts the dump; keep it somewhere other than the backup bucket (required)
#   BACKUP_S3_BUCKET     where to upload; leave empty to just write the file locally
#   BACKUP_S3_ENDPOINT   for R2/B2/MinIO; leave empty for AWS S3
#   BACKUP_DIR           local folder (default ./backups)
set -euo pipefail

: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL is required}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is required}"
[ "${#BACKUP_PASSPHRASE}" -ge 16 ] || { echo "BACKUP_PASSPHRASE must be at least 16 characters" >&2; exit 1; }

dir="${BACKUP_DIR:-./backups}"
mkdir -p "$dir"
name="harborline-$(date -u +%Y%m%dT%H%M%SZ).dump.gpg"
file="$dir/$name"

# Custom format is compressed and lets pg_restore restore selectively.
pg_dump --format=custom --no-owner --no-privileges "$BACKUP_DATABASE_URL" \
  | gpg --batch --yes --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" --symmetric --cipher-algo AES256 --output "$file"

# A dump that is too small is almost always a failed dump.
size=$(wc -c < "$file")
[ "$size" -gt 2048 ] || { echo "Backup is suspiciously small ($size bytes)" >&2; rm -f "$file"; exit 1; }
echo "Wrote $file ($size bytes)"

if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  endpoint=()
  [ -n "${BACKUP_S3_ENDPOINT:-}" ] && endpoint=(--endpoint-url "$BACKUP_S3_ENDPOINT")
  aws "${endpoint[@]}" s3 cp "$file" "s3://$BACKUP_S3_BUCKET/postgres/$name" --only-show-errors
  echo "Uploaded to s3://$BACKUP_S3_BUCKET/postgres/$name"
  rm -f "$file"
fi
