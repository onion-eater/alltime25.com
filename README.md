# AllTime 25

AllTime 25 creates a personal NBA career ranking through statistical
comparisons. New rankings use Top 25 / Normal mode; Top 10, Top 25, and Top 50
can each be played with identities visible or hidden. React renders the
one-page experience; FastAPI owns ranking behavior, ties, undo, player pools,
identity disclosure, and transactional persistence. PostgreSQL is used for the
private beta; SQLite remains available for local development and unit tests.

## Repository rules

Read [AGENTS.md](AGENTS.md) and [docs/architecture.md](docs/architecture.md)
before editing. The automated architecture check is mandatory.

## Requirements

- Node.js 22+
- npm 10+
- Python 3.12–3.14
- uv 0.11+
- PostgreSQL 17 for integration and beta environments

## Install

```bash
uv sync --project apps/api --group dev
npm --prefix apps/web install
```

## Run

API:

```bash
uv run --project apps/api uvicorn alltime25.main:app \
  --app-dir apps/api/src --reload --port 8000
```

Web:

```bash
npm --prefix apps/web run dev -- --host 127.0.0.1 --port 5173
```

Production-like local container:

```bash
docker compose --profile beta up --build
```

## Generate the client contract

With the backend environment installed:

```bash
uv run --project apps/api python scripts/export_openapi.py
npm --prefix apps/web run generate:api
```

FastAPI's OpenAPI document is canonical. Generated TypeScript files must not be
edited manually.

## Verify

```bash
python3 scripts/check_architecture.py
uv run --project apps/api python -m pytest
uv run --project apps/api ruff check .
npm --prefix apps/web run check
npm --prefix apps/web run test:e2e
```

See [docs/deployment/private-beta.md](docs/deployment/private-beta.md) for the
private-beta release, backup, restore, cleanup, and rollback gates.

## Data status

The current catalog is `nba-public-2025-26-r1`: a frozen 100-player pool with
source-documented NBA.com career and award data through June 30, 2026, plus 100
local portraits. Browser tests build a separate deterministic catalog to
exercise all six preset/identity combinations. The application does not scrape
Sports Reference or hotlink player images.
