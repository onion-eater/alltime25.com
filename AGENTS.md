# AllTime 25 Repository Rules

These rules are mandatory for every change in this repository.

## Canonical ownership

- `apps/api/src/alltime25/domain/` owns ranking rules and domain models.
- `catalog/data/current.json` selects the catalog for new sessions.
- `catalog/data/catalogs/<catalog-id>/` is the only checked-in location for
  immutable player data, pool metadata, manifests, and human-review exports.
- `catalog/assets/catalogs/<catalog-id>/players/` is the only checked-in
  player-image directory.
- `contracts/openapi.json` is the canonical client/server contract.
- `apps/web/src/shared/api/generated/` contains generated API types. Never edit
  those files by hand.
- `apps/web/src/shared/styles/tokens.css` is the only location for colors,
  spacing, typography, borders, and viewport constants used by more than one
  component.
- A reusable component has one canonical implementation. Responsive variants
  consume the same data model and may differ only when their presentation is
  materially different.

## Dependency direction

Backend imports must follow:

```text
domain <- application <- api
   ^            ^
   + infrastructure
```

- `domain` imports only the Python standard library.
- `application` may import `domain` and application ports.
- `infrastructure` may import `domain` and application ports.
- `api` may import application services and API schemas.
- `main.py` is the only composition root allowed to connect API,
  infrastructure, and application implementations.

Frontend imports must follow:

```text
shared <- features <- app
```

- `shared` never imports from `features` or `app`.
- A feature never imports from another feature.
- `app` composes features but contains no ranking rules.
- Use direct file imports. Do not create barrel `index.ts` files.

## Change rules

- Do not add a new top-level directory without updating
  `docs/architecture.md`.
- Do not duplicate API response types in handwritten TypeScript.
- Do not calculate ranking order in React.
- Do not read or write SQLite outside the infrastructure repositories.
- Do not place HTTP details in domain or application modules.
- Do not add gradients, rounded cards, pills, or decorative shadows.
- Do not add visible copy that is absent from the approved design without
  product approval.
- Do not hotlink player images.
- Every data change must update catalog provenance and validation tests.
- Every ranking-rule change starts with a failing domain test.
- Every API change updates the OpenAPI contract and generated TypeScript.

## Required checks

Run all checks before handoff:

```bash
python3 scripts/check_architecture.py
npm --prefix apps/web run check
apps/api/.venv/bin/python -m pytest
apps/api/.venv/bin/ruff check .
```
