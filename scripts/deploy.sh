#!/usr/bin/env bash
# Deploys the app on THIS server. Two ways to run it:
#   by hand:          bash scripts/deploy.sh            (deploys origin/main)
#                     bash scripts/deploy.sh <commit>   (deploys that commit)
#   from GitHub:      the Actions job connects over SSH with a key locked to this script;
#                     the commit to deploy arrives in SSH_ORIGINAL_COMMAND.
# If the build, the migration or the health check fails, the previous code is restored and
# the script exits with an error, so the GitHub job turns red. Database changes are not undone.
{
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$HOME/freight-saas}"
PM2_NAME="${PM2_NAME:-harborline}"
LOG="${DEPLOY_LOG:-$HOME/deploy.log}"

# SSH sessions start with a short PATH; make node, npm and pm2 findable.
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"

exec > >(tee -a "$LOG") 2>&1
echo "=== Deploy started $(date -u +%FT%TZ) ==="

WANT="${1:-${SSH_ORIGINAL_COMMAND:-}}"
if [ -n "$WANT" ] && ! [[ "$WANT" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Refusing to deploy: '$WANT' is not a full commit hash."
  exit 2
fi

cd "$APP_DIR"
PREVIOUS="$(git rev-parse HEAD)"
git fetch --prune origin
TARGET="${WANT:-$(git rev-parse origin/main)}"
git cat-file -e "$TARGET^{commit}"

if [ "$TARGET" = "$PREVIOUS" ] && [ -z "${FORCE:-}" ]; then
  echo "Already on $TARGET. Nothing to do (set FORCE=1 to redeploy)."
  exit 0
fi

rollback() {
  trap - ERR
  echo "!!! Deploy failed. Restoring $PREVIOUS"
  git reset --hard "$PREVIOUS"
  npm ci --no-audit --no-fund || true
  npm run build || true
  pm2 reload "$PM2_NAME" --update-env || true
  echo "!!! Rolled back the code. Database changes, if any, were not undone."
  exit 1
}
trap rollback ERR

echo "Deploying ${PREVIOUS:0:7} -> ${TARGET:0:7}"
git reset --hard "$TARGET"
npm ci --no-audit --no-fund
npm run build
npx tsx --env-file=.env src/db/migrate.ts
pm2 reload "$PM2_NAME" --update-env

echo "Waiting for the app to answer..."
curl --silent --show-error --fail --retry 12 --retry-delay 3 --retry-connrefused \
  http://127.0.0.1:3000/api/health
echo
echo "=== Deployed ${TARGET:0:7} OK $(date -u +%FT%TZ) ==="
exit 0
}
