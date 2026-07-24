# AllTime 25 Architecture

## Objective

Keep the codebase small, predictable, and difficult to accidentally duplicate.
The Python API owns data, ranking behavior, ties, undo, and persistence. React
owns presentation and interaction only.

## Repository structure

```text
blind-50/
├── AGENTS.md
├── README.md
├── archive/
│   └── comparison-layouts/
│       └── dual-resume-v1/
├── catalog/
│   ├── data/
│   │   ├── current.json
│   │   └── catalogs/<catalog-id>/
│   │       ├── players.json
│   │       └── pools.json
│   └── assets/catalogs/<catalog-id>/players/
├── contracts/
│   └── openapi.json
├── docs/
│   ├── architecture.md
│   ├── data-provenance.md
│   ├── design/
│   │   ├── README.md
│   │   ├── concepts/
│   │   ├── renders/
│   │   └── source/
│   └── superpowers/
│       ├── plans/
│       └── specs/
├── scripts/
│   ├── check_architecture.py
│   └── export_openapi.py
└── apps/
    ├── api/
    │   ├── pyproject.toml
    │   ├── src/blind50/
    │   │   ├── main.py
    │   │   ├── api/
    │   │   │   ├── dependencies.py
    │   │   │   ├── router.py
    │   │   │   ├── routes/
    │   │   │   │   ├── health.py
    │   │   │   │   └── sessions.py
    │   │   │   └── schemas/
    │   │   │       └── sessions.py
    │   │   ├── application/
    │   │   │   ├── ports/
    │   │   │   │   ├── player_catalog.py
    │   │   │   │   └── session_repository.py
    │   │   │   └── ranking_service.py
    │   │   ├── domain/
    │   │   │   ├── player.py
    │   │   │   └── ranking.py
    │   │   └── infrastructure/
    │   │       ├── catalog/
    │   │       │   ├── json_catalog_registry.py
    │   │       │   └── json_player_catalog.py
    │   │       ├── persistence/
    │   │       │   ├── database.py
    │   │       │   ├── migrations/
    │   │       │   ├── models.py
    │   │       │   └── sql_session_repository.py
    │   │       └── settings.py
    │   └── tests/
    │       ├── integration/api/test_sessions.py
    │       └── unit/domain/test_ranking.py
    └── web/
        ├── package.json
        ├── vite.config.ts
        └── src/
            ├── main.tsx
            ├── app/
            │   └── App.tsx
            ├── features/ranking/
            │   ├── api/rankingApi.ts
            │   ├── components/
            │   │   ├── CompareScreen.tsx
            │   │   ├── DesktopResumeCard.tsx
            │   │   ├── HelpDialog.tsx
            │   │   ├── MobileComparisonTable.tsx
            │   │   ├── ProgressScreen.tsx
            │   │   ├── RankingRow.tsx
            │   │   └── RankingsScreen.tsx
            │   ├── hooks/useRankingSession.ts
            │   └── styles/*.module.css
            └── shared/
                ├── api/
                │   ├── client.ts
                │   └── generated/schema.d.ts
                ├── components/
                │   ├── AppHeader.tsx
                │   ├── ArrowIcon.tsx
                │   └── Footer.tsx
                └── styles/
                    ├── global.css
                    └── tokens.css
```

The tree is a boundary map, not a request to create empty placeholder files.
Files are added when their responsibility is implemented.

Design references are canonical under `docs/design`: approved concepts belong
in `concepts`, final implementation captures in `renders`, and editable
prototype sources in `source`.

Inactive source is canonical under `archive/`. It exists for historical
reference only and is outside application compilation, linting, testing, and
bundling. Code under `apps/` must never import from `archive/`.

## Backend boundaries

### Domain

Pure Python. It defines `PlayerResume`, `RankingState`, `Comparison`,
`VoteOutcome`, and the insertion algorithm. It has no FastAPI, Pydantic,
SQLAlchemy, filesystem, environment, or network imports.

### Application

Coordinates use cases through ports:

- create a ranking session;
- load its next comparison;
- apply a vote;
- undo the latest vote;
- return the current result.

Application code does not know whether storage is SQLite or another database.

### Infrastructure

Implements the catalog registry and SQL repository ports. Immutable player
JSON and images live under the root `catalog/` tree. SQLAlchemy supports
SQLite for local development and PostgreSQL for beta; Alembic is the only
schema migration mechanism. Persistence never decides ranking behavior.

### API

Converts HTTP payloads to application calls and domain results to Pydantic
responses. Routes contain no ranking calculations.

### Composition roots

`main.py` constructs the HTTP application. `blind50.cli.migrate` and
`blind50.cli.cleanup` are isolated operational entrypoints. No feature,
domain, application, or API module may instantiate concrete repositories.

## Frontend boundaries

### Shared

Framework-level utilities, generated API types, the API client, global tokens,
and product-wide chrome. It cannot import ranking feature code.

### Ranking feature

All ranking UI, query functions, and session orchestration. The hook owns async
UI state; the Python API owns ranking state.

### App

Composition only. `App.tsx` chooses which approved screen to render and owns the
help-dialog visibility. It contains no copied screen markup or ranking math.

## Canonical contract workflow

1. FastAPI schemas generate OpenAPI.
2. `scripts/export_openapi.py` writes `contracts/openapi.json`.
3. `openapi-typescript` generates
   `apps/web/src/shared/api/generated/schema.d.ts`.
4. Frontend aliases select types from that generated file.

Handwritten client/server DTO duplication is prohibited.

## Ranking invariant

Rankings are ordered tie groups. A group consumes one displayed rank and its
members share that rank. Later ranks skip the appropriate number of positions.
If the group crossing rank 50 contains multiple players, every member is kept,
so a completed “top 50” may contain more than 50 players.

The current candidate is inserted with binary search over ordered groups. Once
50 positions are occupied, a candidate first faces the cutoff group; a worse
vote eliminates the candidate, while a better or tie vote continues or closes
the insertion. Undo restores the exact state before the latest vote.

## Data policy

- Raw career averages only.
- Regular season and playoffs remain separate.
- Awards: MVP, All-NBA, DPOY, championships, Finals MVP.
- Context: seasons, games, and prominent decade.
- Missing historical statistics are `null` and render as `—`.
- Every catalog has an `as_of` date and source notes.
- Released catalogs contain fixed, nested 25-, 50-, and 100-player candidate
  pools in `pools.json`.
- `catalog/data/current.json` selects only new sessions; saved sessions retain
  their original immutable `catalog_id`.
- Active-player data is never silently mixed across different cutoff dates.
- Sports Reference scraping and production hotlinking are prohibited.

## Visual invariants

- Rankings are the root/home state.
- First visit opens the instructions dialog; `?` reopens it.
- The primary app shell fits inside one viewport at 1440×900 and 390×844.
- Only the footer may sit below the viewport.
- Normal viewports use one centered comparison ledger with equal player
  columns and one exact page centerline.
- Landscape viewports at or below 480px high use the compact comparison matrix
  fed by the same canonical stat-row model.
- Active comparisons never shade, color, or otherwise imply a winning player.
- Ranking rows paginate in place.
- No gradients, pills, rounded cards, decorative shadows, or invented copy.
