# Data provenance

## Development catalog

`development-2024-06-18` is a ten-player fixture used to build and test the
ranking workflow. Career figures were manually assembled from publicly reported
career totals and award histories, frozen through the 2023-24 season for the
one active player in the set.

This fixture is not approved as the production data source. Every record carries
the same `as_of` date so active and retired data are not silently mixed.
Unavailable historical steals and blocks are stored as `null`.

## Public NBA.com catalog

`nba-public-2025-26-r1` is the current 100-player release catalog, frozen
through June 30, 2026. The offline importer uses NBA.com player IDs and official
career-stat and award endpoints. It calculates career rates from totals and
keeps regular-season and playoff records separate.

Revision `r1` resolves NBA's duplicate Patrick Ewing name records to Hall of
Famer Patrick Ewing (`121`) instead of Patrick Ewing Jr. (`201607`). The
original immutable catalog remains available for sessions that started on it.

The catalog includes local portraits. NBA's public CDN supplies 95 headshots.
The CDN returns one generic silhouette for Jason Kidd, Patrick Ewing, Alex
English, Lenny Wilkens, and Sidney Moncrief, so those five use locally stored
Wikimedia Commons images. Each replacement's author, license, and source URL are
recorded in `review.csv`. The application never hotlinks player images.

The ignored `.catalog-cache/` directory contains the raw NBA responses and
downloaded source images. It is import-only and is not distributed.

## Production requirements

A production 100-player catalog must provide:

- explicit permission or a compatible license for statistics and images;
- a reproducible update process;
- one declared cutoff date;
- source notes for every record;
- validation against official NBA award histories;
- no Sports Reference scraper and no remote image hotlinks.

The frozen roster is canonical in `scripts/catalog/player_pool.json`. The
nested 25-, 50-, and 100-player pools are canonical in
`scripts/catalog/candidate_pools.json`; the catalog builder copies and validates
them into `pools.json`. Top 10 uses the 25-player pool, Top 25 uses the
50-player pool, and Top 50 uses the full 100-player pool.

Provider caches, API keys, written license documents, and source paths are
import-only material. They must remain outside the repository and deployed
site. Publication may contain only normalized catalog data, the public rights
reference recorded by the manifest, review CSV, hashes, and local WebP
portraits.
