# Data provenance

## Development catalog

`development-2024-06-18` is a ten-player fixture used to build and test the
ranking workflow. Career figures were manually assembled from publicly reported
career totals and award histories, frozen through the 2023-24 season for the
one active player in the set.

This fixture is not approved as the production data source. Every record carries
the same `as_of` date so active and retired data are not silently mixed.
Unavailable historical steals and blocks are stored as `null`.

## Player image placeholders

The checked-in player image files contain the same neutral silhouette used by
the application's fallback state. No real player headshots are distributed in
this repository.

Before a production release, replace the placeholders in the canonical asset
directory with licensed images while keeping the stable player IDs and API
paths. Ranking screenshots that previously embedded uncleared development
headshots are intentionally excluded from the repository.

## Production requirements

A production 100-player catalog must provide:

- explicit permission or a compatible license for statistics and images;
- a reproducible update process;
- one declared cutoff date;
- source notes for every record;
- validation against official NBA award histories;
- no Sports Reference scraper and no remote image hotlinks.
