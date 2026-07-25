# AllTime 25 Repository Rules

These rules are mandatory for every change in this repository.

## Canonical ownership

- `apps/web/src/features/ranking/domain/` owns ranking rules and player models.
- `apps/web/src/features/ranking/persistence/` is the only runtime owner of
  localStorage, Web Locks, and cross-tab session synchronization.
- `apps/web/src/features/ranking/session/` builds and validates ranking
  sessions and UI view models.
- `catalog/current.json` selects the catalog for new rankings.
- `catalog/versions/<catalog-id>/` contains one complete immutable catalog:
  player data, pools, provenance, review export, and `images/`.
- `scripts/catalog/` owns offline Python import, normalization, image
  processing, provenance, and publication verification.
- `apps/web/src/shared/styles/tokens.css` owns values reused across components.

## Dependency direction

Frontend imports follow:

```text
shared <- features <- app
```

- `shared` never imports from `features` or `app`.
- A feature never imports from another feature.
- `app` composes features but contains no ranking rules.
- Ranking-domain code is pure TypeScript. It does not import React, browser
  storage, the network, or presentation code.
- Use direct file imports. Do not create barrel `index.ts` files.

## Change rules

- Do not add a production API, serverless function, database, cookie, or
  server-side session.
- Store mutable ranking progress only under
  `alltime25.ranking-session.v1`.
- Store player JSON and portraits as immutable static assets, never in
  localStorage.
- Do not silently discard corrupt progress or use an in-memory persistence
  fallback.
- Do not calculate ranking order inside React components.
- Do not hotlink player images.
- Do not add gradients, rounded cards, pills, decorative shadows, or
  unapproved visible copy.
- Every data change updates catalog provenance and validation tests.
- Every ranking-rule change starts with a failing domain test and preserves the
  committed Python parity vectors.
- Keep Python import credentials, caches, license documents, and private source
  paths outside the repository.

## Required checks

Run all checks before handoff:

```bash
uv sync --frozen --group dev
uv run ruff check .
uv run ruff format --check .
uv run python -m pytest -W error
uv run python scripts/check_architecture.py

npm --prefix apps/web ci
npm --prefix apps/web run lint
npm --prefix apps/web run typecheck
npm --prefix apps/web run test
npm --prefix apps/web run build
npm --prefix apps/web run test:e2e
```
