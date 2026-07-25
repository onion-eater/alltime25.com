# AllTime 25

AllTime 25 creates a personal NBA career ranking through direct statistical
comparisons. New rankings start in Top 25 / Normal mode. Top 10, Top 25, and
Top 50 can each be played with player identities visible or hidden.

The deployed application is a static React site. The browser owns the ranking
algorithm, undo, restart, and progress persistence. Player data and portraits
are immutable static assets; mutable progress is stored only in localStorage.
There is no production API, database, account, cookie, or server-side session.

## Repository rules

Read [AGENTS.md](AGENTS.md) and
[docs/architecture.md](docs/architecture.md) before editing. The automated
architecture check is mandatory.

## Requirements

- Node.js 22
- npm 10+
- Python 3.12–3.14
- uv 0.11+

Python is used only for offline catalog tooling and verification.

## Install

```bash
uv sync --frozen --group dev
npm --prefix apps/web ci
```

## Run

```bash
npm --prefix apps/web run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173`.

## Verify

```bash
uv run ruff check .
uv run ruff format --check .
uv run python -m pytest
uv run python scripts/check_architecture.py

npm --prefix apps/web run lint
npm --prefix apps/web run typecheck
npm --prefix apps/web run test
npm --prefix apps/web run build
npm --prefix apps/web run test:e2e
npm --prefix apps/web audit --audit-level=high
```

End-to-end tests build a deterministic catalog, build the static site, and run
the critical workflows in Chromium, Firefox, and WebKit.

## Browser storage

Only the current or completed ranking is retained. It is stored under
`alltime25.ranking-session.v1` and reconstructed by replaying its saved vote
outcomes. Progress remains until the user restarts or clears site data.

Browser storage has these deliberate limits:

- progress does not sync across devices or browsers;
- private browsing or site-data removal can erase progress;
- there is no account, server backup, or recovery service;
- localStorage must be writable; the app does not silently fall back to memory.

Blind mode removes identities from the active interface and component props.
Because the catalog is downloaded by the browser, it prevents casual visual
bias rather than determined inspection with developer tools.

## Catalogs

`catalog/current.json` selects the immutable catalog for new rankings. Each
release lives entirely under `catalog/versions/<catalog-id>/`.
Saved rankings retain their exact catalog ID. Catalog JSON and portraits are
served as static files and are not copied into localStorage.

The current catalog is `nba-public-2025-26-r1`: a frozen 100-player pool with
source-documented career and award data through June 30, 2026, plus 100 local
portraits. See [docs/data-provenance.md](docs/data-provenance.md) and
[scripts/catalog/README.md](scripts/catalog/README.md) before updating it.

## Deploy

The root [vercel.json](vercel.json) contains the Vite build, output, caching,
and security-header configuration. See
[docs/deployment/vercel.md](docs/deployment/vercel.md) for the release steps.
