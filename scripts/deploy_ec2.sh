#!/usr/bin/env bash
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/gaiko-mvp}
BRANCH=${BRANCH:-main}

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "Repository not found at $APP_DIR"
  echo "Clone first: git clone <repo-url> $APP_DIR"
  exit 1
fi

cd "$APP_DIR"

git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

if [[ ! -f .env ]]; then
  cp .env.ec2.example .env
  echo "Created .env from .env.ec2.example. Update POSTGRES_PASSWORD before production use."
fi

mkdir -p data/uploads data/exports

docker compose up -d --build

echo "Deploy completed."
echo "Health: curl -sS http://localhost/api/health"
