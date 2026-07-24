# Catalog release pipeline

`build_catalog.py` turns a licensed, staged SportsDataIO export into one
immutable Blind 50 catalog. It never runs in the web container.

The staged JSON must contain:

- `provider: "SportsDataIO"`
- a non-empty `provider_version` and extraction timestamp
- written-rights confirmations for historical data display, local image
  caching, and coverage of all 100 players
- exactly the 100 stable IDs in `player_pool.json`
- regular-season and playoff career totals
- regular-season season rows used to derive the prominent decade
- NBA award-audit values and an official NBA source URL
- either a licensed HTTPS `image_url` or a licensed local `image_file`

Run from the repository root:

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
`players.json`, `manifest.json`, `review.csv`, and 100 local 600×800 WebP
assets. The human-review CSV and award audit must be approved before
`--set-current` is used.

The checked-in `development-2024-06-18` catalog is a 10-player development
fixture. It is not licensed production data and cannot pass this release
builder.
