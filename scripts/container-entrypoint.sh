#!/bin/sh
set -eu

python -m alltime25.cli.migrate
exec uvicorn alltime25.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 2 \
  --no-access-log
