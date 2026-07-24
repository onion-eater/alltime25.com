# AllTime 25 Private-Beta Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish AllTime 25 as a private, production-like beta with an exact,
anonymous top-50 ranking workflow, a centered comparison ledger, hardened
persistence, a versioned 100-player catalog boundary, and one deployable
React/FastAPI container.

**Architecture:** The pure Python ranking domain remains authoritative.
FastAPI coordinates versioned catalogs and transactional session mutations,
while PostgreSQL provides compare-and-swap versioning, operation idempotency,
and undo history. React consumes generated OpenAPI types and renders one
centered, neutral comparison model across supported viewport shapes.

**Tech Stack:** Python 3.12, FastAPI, Pydantic, SQLAlchemy, Alembic,
PostgreSQL/SQLite, React 19, TypeScript, Vite, Vitest, Testing Library,
Playwright, Pytest, Ruff, Docker.

## Global Constraints

- Follow `AGENTS.md` and `docs/architecture.md`.
- Keep domain, application, infrastructure, API, shared, feature, and app
  dependency directions intact.
- Do not scrape Basketball Reference, hotlink images, fabricate player data,
  or claim unverified image rights.
- Keep active comparisons anonymous; identities and photos appear only after
  completion.
- Preserve `better`, `tie`, and `worse` semantics and cutoff-spanning ties.
- Keep A and B visually neutral and geometrically centered.
- Only the footer may appear below the fold at supported default-zoom
  viewports.
- Use explicit `null` for unavailable historical values and render it as `—`.
- Regenerate OpenAPI and TypeScript contracts together.

---

### Task 1: Preserve the replaced UI and lock architecture

- [ ] Copy the exact pre-ledger comparison source from commit `9ec3c15` into
      `archive/comparison-layouts/dual-resume-v1/`.
- [ ] Document the archive as inactive reference code.
- [ ] Update architecture documentation and reject active imports from
      `archive/`.
- [ ] Run the architecture checker and commit the archive boundary.

### Task 2: Extend and validate the domain

- [ ] Write failing tests for `three_pct`, nullable historical honors, ranking
      state schema versions, duplicate IDs, invalid bounds, corrupt state, and
      terminal-state invariants.
- [ ] Add the minimal domain fields and invariant validation.
- [ ] Add model-based ranking tests for transitive ordering, tie groups,
      cutoff behavior, inconsistent votes, and termination.
- [ ] Run domain and catalog tests and commit.

### Task 3: Add immutable catalog versions and import tooling

- [ ] Write failing registry tests for current catalog resolution, historical
      catalog lookup, immutable IDs, missing keys, invalid percentages,
      incomplete images, and mixed cutoff dates.
- [ ] Move the development fixture into a versioned catalog directory and add
      `current.json`.
- [ ] Implement the registry and stricter runtime validator.
- [ ] Add `scripts/catalog/` tooling for allowlist normalization, weighted
      career calculations from totals, asset validation, manifest hashes,
      audit CSV output, and exact-100 publication gating.
- [ ] Add the official 76-plus-24 player allowlist without fabricated stats.
- [ ] Run catalog tests and commit.

### Task 4: Replace persistence with versioned operations

- [ ] Write failing repository/service tests for randomized player order,
      stable session codes, compare-and-swap versions, duplicate operations,
      conflicting operation IDs, stale clients, undo branches, expiry, and
      idempotent deletion.
- [ ] Add session, vote, and operation records with cascade rules.
- [ ] Add Alembic configuration and an initial beta schema migration.
- [ ] Implement atomic vote/undo transactions for SQLite and PostgreSQL.
- [ ] Mark legacy development sessions expired rather than converting them
      into 100-player rankings.
- [ ] Run repository and service tests and commit.

### Task 5: Revise the FastAPI contract

- [ ] Write failing API tests for create operation IDs, versions, `can_undo`,
      catalog IDs, 3PT%, nullable awards, new undo route, structured errors,
      readiness, expiry, identity leakage, retry, and stale mutations.
- [ ] Implement request/response schemas and error handlers.
- [ ] Add liveness/readiness, cleanup, security headers, same-origin mutation
      checks, and versioned static catalog assets.
- [ ] Export OpenAPI and regenerate TypeScript types.
- [ ] Run backend tests, Ruff, contract-diff checks, and commit.

### Task 6: Build the centered comparison experience

- [ ] Write failing component tests for the four ordered ledger sections,
      centered neutral headers, 3PT% in both seasons, percentage formatting,
      nullable values, and vote mapping.
- [ ] Implement one canonical stat-row model.
- [ ] Implement `CenterComparisonLedger` and the short-landscape compact
      presentation from that model.
- [ ] Remove inactive comparison components from `apps/web`.
- [ ] Match the accepted v2 concept without leader emphasis or extra copy.
- [ ] Run component tests, type checks, lint, and commit.

### Task 7: Harden browser orchestration and result behavior

- [ ] Write failing hook tests for pending create IDs, request timeouts,
      duplicate clicks, stale refetch, old responses, storage failure,
      cross-tab sync, expiry, retry, and create-first start over.
- [ ] Implement resilient API/session orchestration without optimistic ranking.
- [ ] Add one compact live status region.
- [ ] Add methodology/help focus trapping and concise approved copy.
- [ ] Add image fallback, share/clipboard/export error handling, and
      full-height image containment.
- [ ] Run frontend tests and commit.

### Task 8: Add end-to-end, CI, and deployment gates

- [ ] Add PostgreSQL integration coverage for concurrent mutations,
      rollback, expiry, cleanup, migration, and readiness.
- [ ] Add Playwright geometry, overflow, accessibility, and full-workflow
      coverage at the approved viewport matrix.
- [ ] Add CI jobs for architecture, Python, PostgreSQL, generated contracts,
      frontend, browser, catalog, container, dependency, and secret checks.
- [ ] Add one multi-stage Docker image and local PostgreSQL compose stack.
- [ ] Document environment, migrations, cleanup, backups, restore, beta
      access, rate limiting, monitoring, and rollback.
- [ ] Run the complete verification suite and commit only after every
      available gate passes.

## External Release Gate

The beta cannot claim a finished 100-player production catalog until a licensed
provider package and image rights are supplied and pass the exact-100 importer.
Engineering completion includes the immutable catalog boundary, allowlist,
importer, validation, audit output, and deployment block; it does not include
invented statistics or unlicensed images.
