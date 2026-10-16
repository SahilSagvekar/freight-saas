#!/usr/bin/env bash
# Restores an encrypted backup into a database you name. Never point it at the live database
# unless you are deliberately recovering; restore into a scratch database first to check the backup.
#   scripts/restore.sh backups/harborline-2026....dump.gpg postgres://postgres@127.0.0.1:5432/restore_check
set -euo pipefail
file="${1:?usage: restore.sh <file.dump.gpg> <target-database-url>}"
target="${2:?usage: restore.sh <file.dump.gpg> <target-database-url>}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is required}"

gpg --batch --yes --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" --decrypt "$file" \
  | pg_restore --no-owner --no-privileges --exit-on-error --dbname "$target"
echo "Restored. Now run: npm run db:migrate (re-applies the app role's privileges) and check a few bookings."
