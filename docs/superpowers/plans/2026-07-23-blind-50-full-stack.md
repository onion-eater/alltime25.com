# Blind 50 Full-Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved Blind 50 interface as a React application backed
by a Python API that owns exact ranking, ties, undo, persistence, and canonical
player data.

**Architecture:** A Vite React client consumes generated FastAPI contracts and
contains presentation only. A cleanly layered FastAPI service keeps the ranking
engine pure, coordinates use cases through ports, and persists sessions in
SQLite. The repository structure and dependency direction are enforced by
scripts and lint rules.

**Tech Stack:** React 19.2.8, TypeScript 5.9.3, Vite 8.1.5, FastAPI, Pydantic,
SQLAlchemy, SQLite, Vitest, Testing Library, Pytest, Ruff, ESLint,
openapi-typescript.

## Global Constraints

- Follow `AGENTS.md` at the repository root.
- Follow `docs/architecture.md`; update it before introducing a new boundary.
- Python owns player data, comparisons, rank groups, ties, cutoff, completion,
  undo, and persistence.
- React contains no ranking calculations and no handwritten API DTO copies.
- Raw career regular-season and playoff values only; missing values are null.
- Include MVP, All-NBA, DPOY, championships, and Finals MVP.
- The first-visit instructions dialog and `?` help button are required.
- Rankings are the home state.
- Primary UI must fit 1440×900 and 390×844; only the footer may be below fold.
- No gradients, rounded cards, pills, decorative shadows, or invented copy.
- Do not scrape Sports Reference or hotlink production images.

---

### Task 1: Reproducible repository and architecture enforcement

**Files:**
- Create: `.gitignore`
- Create: `README.md`
- Create: `scripts/check_architecture.py`
- Create: `apps/api/pyproject.toml`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tsconfig.app.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/eslint.config.js`

**Interfaces:**
- Produces: `python3 scripts/check_architecture.py`
- Produces: `npm --prefix apps/web run check`
- Produces: `uv run --project apps/api python -m pytest`

- [ ] **Step 1: Write the architecture checker**

The checker walks backend Python and frontend TypeScript files. It parses Python
imports with `ast`, rejects domain imports of `fastapi`, `pydantic`,
`sqlalchemy`, `blind50.api`, `blind50.application`, or
`blind50.infrastructure`, rejects shared frontend imports from `app` or
`features`, rejects feature imports from `app`, and rejects barrel `index.ts`
files.

Run:

```bash
python3 scripts/check_architecture.py
```

Expected: `Architecture checks passed.`

- [ ] **Step 2: Create pinned dependency manifests**

The backend package must use a `src` layout and these groups:

```toml
[project]
name = "blind50-api"
version = "0.1.0"
requires-python = ">=3.12,<3.15"
dependencies = [
  "fastapi",
  "pydantic-settings",
  "sqlalchemy",
  "uvicorn",
]

[dependency-groups]
dev = ["httpx", "pytest", "pytest-cov", "ruff"]
```

The web package scripts must be:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "lint": "eslint .",
    "typecheck": "tsc -b --pretty false",
    "check": "npm run lint && npm run typecheck && npm run test && npm run build",
    "generate:api": "openapi-typescript ../../contracts/openapi.json -o src/shared/api/generated/schema.d.ts"
  }
}
```

- [ ] **Step 3: Install and lock dependencies**

Run:

```bash
uv sync --project apps/api --group dev
npm --prefix apps/web install
```

Expected: `apps/api/uv.lock`, `apps/api/.venv/`, `apps/web/package-lock.json`,
and `apps/web/node_modules/`.

- [ ] **Step 4: Document local commands**

`README.md` must contain exact install, API, web, contract-generation, and check
commands. It must state that the checked-in catalog is a development catalog
and that production data/image licensing is unresolved.

- [ ] **Step 5: Verify the structure gate**

Run:

```bash
python3 scripts/check_architecture.py
```

Expected: `Architecture checks passed.`

### Task 2: Pure ranking domain with exact ties and undoable state

**Files:**
- Create: `apps/api/src/blind50/domain/player.py`
- Create: `apps/api/src/blind50/domain/ranking.py`
- Create: `apps/api/tests/unit/domain/test_ranking.py`

**Interfaces:**
- Produces: `PlayerResume`, `CareerStats`, `Honors`
- Produces: `VoteOutcome`, `RankingState`, `Comparison`
- Produces: `start_ranking(player_ids, target_size) -> RankingState`
- Produces: `current_comparison(state) -> Comparison | None`
- Produces: `apply_vote(state, outcome) -> RankingState`
- Produces: `visible_rank_groups(state) -> tuple[RankGroup, ...]`

- [ ] **Step 1: Write failing rank-group tests**

Cover:

```python
def test_better_vote_inserts_candidate_before_compared_group():
    state = start_ranking(("a", "b"), target_size=2)
    result = apply_vote(state, VoteOutcome.BETTER)
    assert result.groups == (RankGroup(("b",)), RankGroup(("a",)))


def test_worse_vote_moves_candidate_after_compared_group():
    state = start_ranking(("a", "b"), target_size=2)
    result = apply_vote(state, VoteOutcome.WORSE)
    assert result.groups == (RankGroup(("a",)), RankGroup(("b",)))


def test_tie_vote_adds_candidate_to_existing_group():
    state = start_ranking(("a", "b"), target_size=2)
    result = apply_vote(state, VoteOutcome.TIE)
    assert result.groups == (RankGroup(("a", "b")),)


def test_tie_group_crossing_cutoff_is_kept_in_full():
    state = start_ranking(("a", "b", "c"), target_size=2)
    state = apply_vote(state, VoteOutcome.WORSE)
    result = apply_vote(state, VoteOutcome.TIE)
    assert result.groups == (RankGroup(("a",)), RankGroup(("b", "c")))
    assert sum(len(group.player_ids) for group in visible_rank_groups(result)) == 3


def test_candidate_worse_than_established_cutoff_is_eliminated():
    state = start_ranking(("a", "b", "c"), target_size=2)
    state = apply_vote(state, VoteOutcome.WORSE)
    result = apply_vote(state, VoteOutcome.WORSE)
    assert result.groups == (RankGroup(("a",)), RankGroup(("b",)))
    assert result.eliminated_count == 1


def test_missing_comparison_after_completion():
    state = start_ranking(("a", "b"), target_size=2)
    result = apply_vote(state, VoteOutcome.WORSE)
    assert current_comparison(result) is None


def test_state_round_trips_through_dict_without_changing_comparison():
    state = start_ranking(("a", "b", "c"), target_size=2)
    restored = RankingState.from_dict(state.to_dict())
    assert restored == state
    assert current_comparison(restored) == current_comparison(state)
```

Run:

```bash
uv run --project apps/api python -m pytest tests/unit/domain/test_ranking.py -q
```

Expected: failure because `blind50.domain.ranking` does not exist.

- [ ] **Step 2: Implement immutable domain values**

Use frozen dataclasses and string enums. `RankingState` contains:

```python
@dataclass(frozen=True)
class RankingState:
    remaining_player_ids: tuple[str, ...]
    groups: tuple[RankGroup, ...]
    candidate_id: str | None
    low: int
    high: int
    compared_group_index: int | None
    target_size: int
    votes_count: int
    ties_count: int
    eliminated_count: int
```

`RankGroup` stores `player_ids: tuple[str, ...]`. No persistence or HTTP types
may appear in the domain.

- [ ] **Step 3: Implement cutoff-first binary insertion**

The engine must:

1. seed the first player as the first group;
2. establish a candidate from the remaining sequence;
3. compare to the cutoff group first when 50 positions are occupied;
4. eliminate on `worse` at the cutoff;
5. otherwise binary-search the eligible groups;
6. add ties to the compared group;
7. start the next candidate until complete.

- [ ] **Step 4: Run domain tests**

Run:

```bash
uv run --project apps/api python -m pytest tests/unit/domain/test_ranking.py -q
```

Expected: all domain tests pass.

- [ ] **Step 5: Verify domain purity**

Run:

```bash
python3 scripts/check_architecture.py
```

Expected: `Architecture checks passed.`

### Task 3: Catalog, SQLite repository, application service, and API

**Files:**
- Create: `apps/api/src/blind50/application/ports/player_catalog.py`
- Create: `apps/api/src/blind50/application/ports/session_repository.py`
- Create: `apps/api/src/blind50/application/ranking_service.py`
- Create: `apps/api/src/blind50/infrastructure/settings.py`
- Create: `apps/api/src/blind50/infrastructure/catalog/json_player_catalog.py`
- Create: `apps/api/src/blind50/infrastructure/catalog/data/players.json`
- Create: `apps/api/src/blind50/infrastructure/catalog/assets/players/*.jpg`
- Create: `apps/api/src/blind50/infrastructure/persistence/database.py`
- Create: `apps/api/src/blind50/infrastructure/persistence/models.py`
- Create: `apps/api/src/blind50/infrastructure/persistence/sqlite_session_repository.py`
- Create: `apps/api/src/blind50/api/schemas/sessions.py`
- Create: `apps/api/src/blind50/api/routes/health.py`
- Create: `apps/api/src/blind50/api/routes/sessions.py`
- Create: `apps/api/src/blind50/api/dependencies.py`
- Create: `apps/api/src/blind50/api/router.py`
- Create: `apps/api/src/blind50/main.py`
- Create: `apps/api/tests/integration/api/test_sessions.py`
- Create: `docs/data-provenance.md`
- Create: `scripts/export_openapi.py`
- Create: `contracts/openapi.json`

**Interfaces:**
- Consumes: ranking domain from Task 2
- Produces: `RankingService.create_session()`
- Produces: `RankingService.get_session(session_id)`
- Produces: `RankingService.vote(session_id, outcome)`
- Produces: `RankingService.undo(session_id)`
- Produces: `/api/v1/sessions` HTTP contract

- [ ] **Step 1: Write failing catalog and API tests**

Catalog validation covers unique IDs, required provenance, image existence,
finite numeric values, non-negative games/awards, and one shared `as_of` date
for active players.

API behavior covers:

```python
def test_create_session_returns_anonymous_comparison(client):
    response = client.post("/api/v1/sessions")
    body = response.json()
    assert response.status_code == 201
    assert body["status"] == "active"
    assert body["comparison"]["player_a"]["label"] == "Player A"
    assert body["comparison"]["player_b"]["label"] == "Player B"


def test_vote_changes_comparison_and_persists_after_reload(client):
    created = client.post("/api/v1/sessions").json()
    session_id = created["id"]
    voted = client.post(
        f"/api/v1/sessions/{session_id}/votes",
        json={"outcome": "better"},
    ).json()
    reloaded = client.get(f"/api/v1/sessions/{session_id}").json()
    assert reloaded == voted


def test_undo_restores_previous_comparison(client):
    created = client.post("/api/v1/sessions").json()
    session_id = created["id"]
    client.post(
        f"/api/v1/sessions/{session_id}/votes",
        json={"outcome": "tie"},
    )
    restored = client.delete(
        f"/api/v1/sessions/{session_id}/votes/latest"
    ).json()
    assert restored["comparison"] == created["comparison"]
    assert restored["progress"]["votes"] == 0


def test_active_response_does_not_reveal_names_or_images(client):
    body = client.post("/api/v1/sessions").json()
    serialized = json.dumps(body["comparison"])
    assert '"name"' not in serialized
    assert "image_path" not in serialized


def test_completed_response_reveals_names_and_images(client, finish_session):
    completed = finish_session(client)
    assert completed["status"] == "complete"
    assert completed["ranking"][0]["players"][0]["name"]
    assert completed["ranking"][0]["players"][0]["image_url"]


def test_unknown_session_returns_404(client):
    response = client.get("/api/v1/sessions/not-a-session")
    assert response.status_code == 404
```

Run:

```bash
uv run --project apps/api python -m pytest tests/integration/api/test_sessions.py -q
```

Expected: failure because the API application does not exist.

- [ ] **Step 2: Add the verified development catalog**

Store one JSON array with ten real development players and version metadata.
Each record uses this shape:

```json
{
  "id": "jordan-michael",
  "name": "Michael Jordan",
  "era": "1990s",
  "seasons": 15,
  "regular_season": {
    "games": 1072,
    "ppg": 30.1,
    "rpg": 6.2,
    "apg": 5.3,
    "spg": 2.3,
    "bpg": 0.8,
    "fg_pct": 49.7,
    "ft_pct": 83.5
  },
  "playoffs": {
    "games": 179,
    "ppg": 33.4,
    "rpg": 6.4,
    "apg": 5.7,
    "spg": 2.1,
    "bpg": 0.9,
    "fg_pct": 48.7,
    "ft_pct": 82.8
  },
  "honors": {
    "mvp": 5,
    "all_nba": 11,
    "dpoy": 1,
    "championships": 6,
    "finals_mvp": 6
  },
  "image_path": "/static/players/jordami01.jpg",
  "as_of": "2024-06-18",
  "source_note": "Development fixture; verify before production."
}
```

Copy local prototype images into the one canonical backend asset directory.
Document their temporary development-only status.

- [ ] **Step 3: Implement ports, SQLite, and service**

The repository stores the current state JSON and a stack of prior state JSON
snapshots in a transaction. `undo` pops the latest snapshot and restores it.
The service joins domain IDs to player résumés only when building an API view.

- [ ] **Step 4: Implement routes and anonymity mapping**

Active comparisons expose `Player A`, `Player B`, codes, and stats but never
names, source IDs, or image paths. Completed sessions expose rank groups with
names and images. The create route uses `target_size=min(50, catalog_size)`.

- [ ] **Step 5: Run backend verification**

Run:

```bash
uv run --project apps/api python -m pytest -q
uv run --project apps/api ruff check .
```

Expected: all tests pass and Ruff reports no errors.

- [ ] **Step 6: Export the canonical contract**

Run:

```bash
uv run --project apps/api python scripts/export_openapi.py
```

Expected: `contracts/openapi.json` is deterministic and contains all six
routes.

### Task 4: Generated client, React session orchestration, and approved screens

**Files:**
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/app/App.tsx`
- Create: `apps/web/src/shared/api/client.ts`
- Generate: `apps/web/src/shared/api/generated/schema.d.ts`
- Create: `apps/web/src/shared/components/AppHeader.tsx`
- Create: `apps/web/src/shared/components/ArrowIcon.tsx`
- Create: `apps/web/src/shared/components/Footer.tsx`
- Create: `apps/web/src/shared/styles/tokens.css`
- Create: `apps/web/src/shared/styles/global.css`
- Create: `apps/web/src/features/ranking/api/rankingApi.ts`
- Create: `apps/web/src/features/ranking/hooks/useRankingSession.ts`
- Create: `apps/web/src/features/ranking/components/HelpDialog.tsx`
- Create: `apps/web/src/features/ranking/components/DesktopResumeCard.tsx`
- Create: `apps/web/src/features/ranking/components/MobileComparisonTable.tsx`
- Create: `apps/web/src/features/ranking/components/CompareScreen.tsx`
- Create: `apps/web/src/features/ranking/components/ProgressScreen.tsx`
- Create: `apps/web/src/features/ranking/components/RankingRow.tsx`
- Create: `apps/web/src/features/ranking/components/RankingsScreen.tsx`
- Create: focused `*.module.css` and `*.test.tsx` files beside their owners

**Interfaces:**
- Consumes: generated OpenAPI schema from Task 3
- Produces: `rankingApi.createSession/getSession/vote/undo/deleteSession`
- Produces: `useRankingSession()` screen state and actions
- Produces: faithful desktop and mobile UI

- [ ] **Step 1: Generate API types**

Run:

```bash
npm --prefix apps/web run generate:api
```

Expected: a generated `schema.d.ts` with no handwritten response interfaces.

- [ ] **Step 2: Write failing hook and component tests**

Cover session restoration, first-visit dialog behavior, vote submission,
disabled double-submit, undo, start over, active anonymity, completed reveal,
tie ranks, pagination, Escape-to-close, and focus restoration.

Run:

```bash
npm --prefix apps/web run test
```

Expected: failure because ranking UI modules do not exist.

- [ ] **Step 3: Implement API client and session hook**

`client.ts` owns the base URL, JSON parsing, and `ApiError`. `rankingApi.ts`
binds concrete routes to generated types. `useRankingSession` persists only
`blind50.session_id`, performs optimistic button disabling but no optimistic
ranking, and always replaces state from the API response.

- [ ] **Step 4: Implement the canonical design system**

`tokens.css` contains the accepted off-white, ink, navy, orange, yellow, green,
line colors, square border widths, typography stacks, spacing scale, and app
height constants. Component styles reference variables; repeated raw colors are
prohibited.

- [ ] **Step 5: Implement the approved responsive components**

Desktop uses two `DesktopResumeCard` components around a shared VS marker.
Mobile uses `MobileComparisonTable`, fed the same comparison object. Ranking
rows use one `RankingRow`. Pagination is in place and never lengthens the
document. The footer follows the app-height shell.

- [ ] **Step 6: Run frontend verification**

Run:

```bash
npm --prefix apps/web run check
python3 scripts/check_architecture.py
```

Expected: lint, types, tests, build, and architecture checks pass.

### Task 5: Full hookup and visual fidelity

**Files:**
- Modify only files that fail live hookup or visual comparison.
- Create: `docs/fidelity-ledger.md`

**Interfaces:**
- Consumes: live FastAPI and Vite applications
- Produces: verified end-to-end ranking workflow

- [ ] **Step 1: Run the full stack**

Run in separate terminals:

```bash
uv run --project apps/api uvicorn blind50.main:app --app-dir apps/api/src --reload --port 8000
npm --prefix apps/web run dev -- --host 127.0.0.1 --port 5173
```

Expected: API health is 200 and the React app loads without console errors.

- [ ] **Step 2: Exercise the live workflow**

Create a session, vote better/worse/tie, reload, undo, finish the development
pool, paginate the result, open and close help, and start over. Confirm SQLite
persists state and names/images never appear in active comparison responses.

- [ ] **Step 3: Capture required viewports**

Capture:

- ranking at 1440×900;
- comparison at 1440×900;
- ranking at 390×844;
- comparison at 390×844;
- first-visit help dialog.

Expected: the app shell ends exactly at the viewport bottom and the footer
starts below it.

- [ ] **Step 4: Compare to the accepted design**

Use `view_image` on both accepted references and latest browser captures. Record
at least copy, layout, typography, palette, image treatment, borders/container
model, desktop density, and mobile readability in `docs/fidelity-ledger.md`.
Fix every unintentional mismatch.

- [ ] **Step 5: Run the complete verification suite**

Run:

```bash
python3 scripts/check_architecture.py
uv run --project apps/api python -m pytest
uv run --project apps/api ruff check .
npm --prefix apps/web run check
```

Expected: every command exits zero.

- [ ] **Step 6: Review repository cleanliness**

Run:

```bash
git status --short
find . -name '.DS_Store' -o -name '*.pyc' -o -name '__pycache__'
```

Expected: only intentional source, docs, locks, catalog, and player assets are
untracked or modified; generated caches are ignored.
