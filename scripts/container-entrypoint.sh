#!/bin/sh
set -eu

python -m blind50.cli.migrate
exec uvicorn blind50.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 2 \
  --no-access-log
