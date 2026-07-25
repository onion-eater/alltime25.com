# Catalog release pipeline

The catalog scripts publish one immutable AllTime 25 catalog. They run only
offline and never in the web container.

## Public NBA.com import

`fetch_public_nba_catalog.py` maps the frozen 100-player roster to NBA.com IDs,
downloads official career and award data through `nba_api`, and stores local
portraits instead of hotlinking them. NBA's CDN supplies 95 portraits. Five
historical players whose CDN response is the generic silhouette use documented
Wikimedia Commons replacements.

Run from the repository root:

```bash
uv run --project apps/api python scripts/catalog/fetch_public_nba_catalog.py \
  --catalog-id nba-public-2025-26 \
  --as-of 2026-06-30 \
  --license-reference "Project owner-approved public-source catalog." \
  --set-current
```

Raw responses and downloaded source images remain in the ignored
`.catalog-cache/` directory. Publication produces normalized JSON, a review
CSV, a hash manifest, and 100 local 600×800 WebP portraits.

## Staged provider import

`build_catalog.py` also accepts a staged SportsDataIO export.

The staged JSON must contain:

- `provider: "SportsDataIO"`
- a non-empty `provider_version` and extraction timestamp
- written-rights confirmations for historical data display, local image
  caching, and coverage of all 100 players
- exactly the 100 stable IDs in `player_pool.json`
- the fixed nested mode pools in `candidate_pools.json`
- regular-season and playoff career totals
- regular-season season rows used to derive the prominent decade
- NBA award-audit values and an official NBA source URL
- either a licensed HTTPS `image_url` or a licensed local `image_file`

Example:

```bash
uv run --project apps/api python scripts/catalog/build_catalog.py \
  --input /secure/import/sportsdataio-export.json \
  --catalog-id beta-2025-26 \
  --as-of 2026-06-30 \
  --license-reference /secure/licenses/sportsdataio-beta-rights.pdf \
  --set-current
```

`SPORTSDATAIO_API_KEY` is read only by this import process when a staged image
URL needs the provider header. It is never copied into catalog output.

The builder refuses to overwrite an existing catalog. Publication produces
`players.json`, `pools.json`, `manifest.json`, `review.csv`, and 100 local
600×800 WebP assets. The human-review CSV and award audit must be approved before
`--set-current` is used.

The checked-in `development-2024-06-18` catalog is a 10-player development
fixture. It is not licensed production data and cannot pass this release
builder.
