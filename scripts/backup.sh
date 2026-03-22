#!/usr/bin/env bash
set -euo pipefail

mkdir -p backups
stamp=$(date +%Y%m%d_%H%M%S)

docker compose exec -T db pg_dump -U app app > "backups/db_${stamp}.sql"
tar -czf "backups/files_${stamp}.tar.gz" data

echo "backup completed: ${stamp}"
