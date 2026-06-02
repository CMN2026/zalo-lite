#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$SCRIPT_DIR/docker-compose.production.yml}"

if docker info >/dev/null 2>&1; then
  DOCKER="docker"
elif command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
  DOCKER="sudo docker"
else
  echo "Docker is not accessible for the current user." >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing production env file: $ENV_FILE" >&2
  exit 1
fi

if [ -n "${GHCR_USERNAME:-}" ] && [ -n "${GHCR_TOKEN:-}" ]; then
  echo "$GHCR_TOKEN" | $DOCKER login ghcr.io -u "$GHCR_USERNAME" --password-stdin
fi

$DOCKER compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull
$DOCKER compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d postgres redis livekit

set +e
migrate_output="$($DOCKER compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm user-service npx prisma migrate deploy 2>&1)"
migrate_status=$?
set -e

if [ $migrate_status -ne 0 ]; then
  printf '%s\n' "$migrate_output"

  case "$migrate_output" in
    *"Error: P3005"*)
      echo "Detected existing schema without Prisma baseline. Marking initial migration as applied."
      $DOCKER compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm user-service \
        npx prisma migrate resolve --applied 20260411081648_init
      $DOCKER compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm user-service \
        npx prisma migrate deploy
      ;;
    *)
      exit $migrate_status
      ;;
  esac
fi

$DOCKER compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d

for container in \
  zalo-nginx \
  zalo-user-service \
  zalo-chat-service \
  zalo-chatbot-service \
  zalo-post-service \
  zalo-api-gateway
do
  status="$($DOCKER inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}running{{end}}' "$container" 2>/dev/null || true)"
  if [ "$status" = "healthy" ] || [ "$status" = "running" ]; then
    continue
  fi

  echo "Container $container is not healthy: ${status:-missing}" >&2
  exit 1
done

$DOCKER image prune -f
