#!/bin/sh
set -eu
IMAGE=$1
ACTOR=$2
RELEASE=$3
ROOT=/share/Container/atchooo-space
DOCKER=/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker
case "$IMAGE" in ghcr.io/sonessica/atchooo-space@sha256:*) ;; *) echo 'Invalid image'; exit 1;; esac
cd "$ROOT"
mkdir .deploy-lock || { echo 'Deployment already running'; exit 1; }
AUTH=$(mktemp -d /tmp/atchooo-registry.XXXXXX)
trap 'rm -f "$AUTH/config.json"; rmdir "$AUTH" "$ROOT/.deploy-lock"' EXIT
export DOCKER_CONFIG="$AUTH"
"$DOCKER" login ghcr.io -u "$ACTOR" --password-stdin
"$DOCKER" pull "$IMAGE"
OLD=$("$DOCKER" inspect --format '{{.Image}}' atchooo-space)
cp docker-compose.yml "$RELEASE/previous-compose.yml"
if [ -f deploy-image.env ]; then cp deploy-image.env "$RELEASE/previous-image.env"; fi
# SQLite online backup includes committed WAL data. Never copy a live DB file alone.
"$DOCKER" exec atchooo-space node -e "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync('/app/data/atchooo-space.sqlite'); db.exec(\"VACUUM INTO '/app/data/deploy-backup-${RELEASE##*/}.sqlite'\"); db.close()"
"$DOCKER" cp "atchooo-space:/app/data/deploy-backup-${RELEASE##*/}.sqlite" "$RELEASE/before.sqlite"
"$DOCKER" exec atchooo-space node -e "require('fs').unlinkSync('/app/data/deploy-backup-${RELEASE##*/}.sqlite')"
cp "$RELEASE/docker-compose.yml" docker-compose.yml
printf 'ATCHOOO_IMAGE=%s\n' "$IMAGE" > deploy-image.env
compose() { "$DOCKER" compose --env-file .env --env-file deploy-image.env "$@"; }
rollback() {
  echo 'Deployment failed; restoring previous application image (data unchanged)'
  cp "$RELEASE/previous-compose.yml" docker-compose.yml
  printf 'ATCHOOO_IMAGE=%s\n' "$OLD" > deploy-image.env
  # Old Compose hardcodes the local image; retag the previous image for compatibility.
  "$DOCKER" tag "$OLD" atchooo-space:latest
  compose up -d --no-build --pull never
  exit 1
}
compose up -d --no-build --pull never || rollback
for attempt in $(seq 1 45); do
  if "$DOCKER" exec atchooo-space node -e "fetch('http://127.0.0.1:3000/api/private/editor?space=bookmarks').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    echo "Deployed $IMAGE; SQLite endpoint healthy"
    exit 0
  fi
  sleep 2
done
rollback
