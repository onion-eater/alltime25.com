# AllTime 25 architecture

## Objective

Keep the production application static and predictable. React owns the ranking
rules, interaction, persistence, and rendering. Python is offline tooling only.

## Repository structure

```text
alltime25/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── vercel.json
├── apps/web/
│   ├── package.json
│   ├── playwright.config.ts
│   ├── vite.config.ts
│   └── src/
│       ├── app/
│       ├── features/ranking/
│       │   ├── catalog/
│       │   ├── components/
│       │   ├── domain/
│       │   ├── hooks/
│       │   ├── model/
│       │   ├── persistence/
│       │   ├── session/
│       │   └── share/
│       └── shared/
├── catalog/
│   ├── current.json
│   └── versions/<catalog-id>/
│       ├── players.json
│       ├── pools.json
│       ├── manifest.json
│       ├── review.csv
│       └── images/
├── docs/
│   ├── architecture.md
│   ├── data-provenance.md
│   └── deployment/vercel.md
├── scripts/
│   ├── catalog/
│   ├── testing/
│   └── check_architecture.py
└── tests/catalog/
```

The tree describes ownership. It is not a request to create empty placeholder
files.

## Runtime boundaries

### Ranking domain

`apps/web/src/features/ranking/domain/` owns the pure TypeScript ranking
algorithm and player models. It has no React, browser storage, network, or
presentation dependencies.

Rankings are ordered tie groups. Members of one group share a displayed rank,
and later ranks skip the required positions. A tie group that crosses the
selected cutoff remains intact on the website.

The current candidate is Player A. The established opponent is Player B. The
candidate is inserted with binary search over ordered groups. Once the target
is occupied, a candidate first faces the cutoff group. Undo removes the latest
outcome and deterministically replays the remaining outcomes.

The TypeScript behavior is locked to committed parity vectors produced by the
former Python implementation. Property and exhaustive tests verify termination,
immutability, tie behavior, cutoff behavior, and pools up to 100 players.

### Catalog

`catalog/` is Vite's public directory. The browser catalog repository:

- reads `current.json` only when creating a ranking;
- restores the exact catalog ID stored with existing progress;
- validates player fields, pools, paths, and identifiers before use;
- caches validated catalogs in memory for repeated lookups.

Released catalogs are immutable. A new data release gets a new catalog ID;
existing catalog files are never edited in place.

### Persistence

`apps/web/src/features/ranking/persistence/` is the only runtime owner of
localStorage, Web Locks, storage events, and BroadcastChannel notifications.

One compact session is stored under:

```text
alltime25.ranking-session.v1
```

It contains the catalog ID, selected mode, cryptographically shuffled player
order, vote outcomes, revision, mutation ID, and timestamps. It does not store
player JSON, portraits, or intermediate ranking snapshots.

Every vote, undo, and restart:

1. acquires the exclusive `alltime25.ranking-session` Web Lock;
2. reloads and validates the stored session;
3. rejects a stale displayed revision;
4. derives and validates the next session;
5. writes and reads it back;
6. adopts the result only after the verified write succeeds.

The `storage` event is the cross-tab source of truth. BroadcastChannel is only
an immediate notification. A corrupt saved session remains intact until the
user explicitly creates a replacement; it is never silently reset.

### Session and view models

`apps/web/src/features/ranking/session/` reconstructs ranking state by replaying
outcomes, resolves player data, and creates the canonical React view model.

Normal comparisons include names and portrait URLs. Active Blind comparisons
receive only anonymous labels, session-specific codes, eras, seasons,
statistics, and honors. Both modes reveal player identities after completion.
The static catalog is still inspectable in a client-only application, so Blind
mode is an interface constraint rather than cryptographic secrecy.

### React

The ranking hook exposes loading, submission, errors, status announcements,
vote, undo, restart, and retry. Components render that controller and do not
calculate ranking order or access localStorage.

The dependency direction is:

```text
shared <- features <- app
```

Shared code cannot import feature or app code. Features cannot import app code
or cross-import another feature. The architecture checker enforces these
boundaries and prohibits runtime API code.

## Static deployment

Vite copies the selected catalog into `apps/web/dist` and builds content-hashed
JavaScript and CSS. Vercel serves that directory directly. There are no
functions, runtime secrets, database connections, API routes, health checks, or
background jobs.

Versioned catalog data and portraits receive immutable caching. The current
catalog pointer must revalidate so a new release can select a new immutable
catalog. Security headers are defined in the root `vercel.json`.

## Data policy

- Raw career averages only.
- Regular season and playoffs remain separate.
- Awards: MVP, All-NBA, DPOY, championships, Finals MVP.
- Context: seasons, games, and prominent decade.
- Missing historical values are `null` and render as `—`.
- Every catalog has one cutoff date and recorded sources.
- Pools are fixed and nested: Top 10 uses 25 candidates, Top 25 uses 50, and
  Top 50 uses 100.
- No player-image hotlinking.

## Visual invariants

- Rankings are the root state.
- First visit opens Help; `?` reopens it.
- Normal viewports use one centered, neutral ledger with equal player columns.
- Viewports at or below 480px high use the compact comparison matrix.
- Active comparisons do not imply a winner through color or styling.
- Portraits use full-image containment.
- Result rankings scroll inside the available viewport.
- Sharing produces one 1080×1350 text-only PNG.
- No first-place highlight, gradients, pills, rounded cards, or decorative
  shadows.
