# AllTime 25 Full-Stack Design

## Product

AllTime 25 builds a personal top-50 NBA career ranking from a curated pool of
100 candidates. Identities remain hidden during comparisons. The result reveals
names and player photos only after the ranking is complete.

The accepted visual reference is the v5 design prototype. The ranking capture
is excluded until licensed player imagery is available:

- [mobile comparison reference](../../design/concepts/compare-mobile-v5.png);
- [interactive source](../../design/source/design-v5.html).

## Experience

The ranking is the home page. A new visitor sees the comparison surface behind
a compact instructions dialog. The dialog contains three steps: compare blind
résumés; pick A, B, or tie; reveal the ranking. The header `?` help button
reopens it.

An active session shows one comparison, one progress indicator, three vote
buttons, undo, and saved status. A completed session shows the revealed ranking,
pagination, tie ranks, real player photos, review/share/export/start-over
actions, and the rule that ties at the cutoff are included.

All primary content must stay inside the viewport. The footer is the sole
content allowed below the fold.

## Player résumé

Each anonymous résumé contains:

- prominent decade;
- seasons played;
- regular-season games;
- playoff games;
- regular-season PPG, RPG, APG, SPG, BPG, FG%, and FT%;
- playoff PPG, RPG, APG, SPG, BPG, FG%, and FT%;
- MVP, All-NBA, DPOY, championship, and Finals MVP counts.

Only raw career numbers are shown. Unavailable historical values render as an
em dash. No peak or era-adjusted values are shown.

## Ranking behavior

The backend stores rankings as ordered tie groups and chooses comparisons with
binary insertion. Votes have exactly three outcomes: `better`, `tie`, and
`worse`. A tie adds the candidate to the compared player’s group.

The target is the first 50 ranked positions from 100 candidates. Once the
cutoff exists, candidates worse than the cutoff are eliminated without being
fully inserted. A tie group crossing position 50 is preserved in full. Undo
restores the complete pre-vote state.

The API, not React, owns candidate order, comparison choice, progress, ranking
groups, tie handling, cutoff behavior, and completion.

## Persistence

SQLite stores session identifiers, serialized domain state, and vote history.
The browser stores only the opaque current-session identifier and whether the
instructions dialog has been dismissed.

No authentication or user accounts are included in this slice.

## API

- `GET /api/v1/health`
- `POST /api/v1/sessions`
- `GET /api/v1/sessions/{session_id}`
- `POST /api/v1/sessions/{session_id}/votes`
- `DELETE /api/v1/sessions/{session_id}/votes/latest`
- `DELETE /api/v1/sessions/{session_id}`

Session responses contain status, progress, the anonymous comparison when
active, and revealed ranking rows only when complete.

## Data delivery

The application ships with a small, versioned, verified development catalog to
exercise the complete workflow. The architecture accepts a 100-player catalog
without code changes. A production 100-player release is blocked on choosing a
permitted, maintainable statistics and image source; fabricated filler and
Basketball Reference scraping are explicitly excluded.

## Technology

- React 19.2.8, TypeScript 5.9.3, and Vite 8.1.5.
- FastAPI with Pydantic, SQLAlchemy, and SQLite.
- Vitest and Testing Library for frontend behavior.
- Pytest for domain and API behavior.
- Ruff for Python linting and formatting.
- ESLint and TypeScript for frontend linting and type checking.
- OpenAPI-generated TypeScript contracts.

## Structure

`docs/architecture.md` is normative. `AGENTS.md` makes its ownership and
dependency rules mandatory. `scripts/check_architecture.py`, ESLint restricted
imports, backend domain-import tests, generated-contract checks, and catalog
validation enforce the important boundaries.

## Non-goals

- User accounts or cloud synchronization.
- Social feeds, public leaderboards, or consensus rankings.
- Admin editing UI.
- Automatic live-stat updates.
- Peak metrics, advanced metrics, or era adjustment.
- A production scraper.
