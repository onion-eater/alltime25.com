from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import os
import shutil
import tempfile
import urllib.request
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from PIL import Image, UnidentifiedImageError

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CATALOG_ROOT = REPOSITORY_ROOT / "catalog"
PLAYER_POOL_PATH = Path(__file__).resolve().parent / "player_pool.json"
CANDIDATE_POOLS_PATH = Path(__file__).resolve().parent / "candidate_pools.json"
IMAGE_SIZE = (600, 800)
REQUIRED_RIGHTS = (
    "historical_data_display",
    "local_image_caching",
    "all_player_coverage",
)
SUPPORTED_PROVIDERS = ("NBA.com", "SportsDataIO")
COUNT_FIELDS = (
    "mvp",
    "all_nba",
    "championships",
)
NULLABLE_COUNT_FIELDS = ("dpoy", "finals_mvp")
TOTAL_FIELDS = (
    "games",
    "points",
    "rebounds",
    "assists",
    "steals",
    "blocks",
    "field_goals_made",
    "field_goals_attempted",
    "three_points_made",
    "three_points_attempted",
    "free_throws_made",
    "free_throws_attempted",
)
REVIEW_FIELDS = (
    "id",
    "provider_id",
    "name",
    "era",
    "seasons",
    "regular_games",
    "regular_ppg",
    "regular_rpg",
    "regular_apg",
    "regular_spg",
    "regular_bpg",
    "regular_fg_pct",
    "regular_three_pct",
    "regular_ft_pct",
    "playoff_games",
    "playoff_ppg",
    "playoff_rpg",
    "playoff_apg",
    "playoff_spg",
    "playoff_bpg",
    "playoff_fg_pct",
    "playoff_three_pct",
    "playoff_ft_pct",
    "mvp",
    "all_nba",
    "dpoy",
    "championships",
    "finals_mvp",
    "award_source",
    "record_source",
    "image_license",
)


class CatalogBuildError(ValueError):
    pass


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build one immutable licensed AllTime 25 catalog."
    )
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--catalog-id", required=True)
    parser.add_argument("--as-of", required=True)
    parser.add_argument("--license-reference", required=True)
    parser.add_argument(
        "--catalog-root",
        type=Path,
        default=DEFAULT_CATALOG_ROOT,
    )
    parser.add_argument("--set-current", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    payload = load_json(args.input)
    pool = load_json(PLAYER_POOL_PATH)
    candidate_pools = load_json(CANDIDATE_POOLS_PATH)
    build_catalog(
        payload=payload,
        pool=pool,
        candidate_pools=candidate_pools,
        catalog_root=args.catalog_root,
        catalog_id=args.catalog_id,
        as_of=args.as_of,
        license_reference=args.license_reference,
        set_current=args.set_current,
    )
    print(f"Published immutable catalog {args.catalog_id}.")
    return 0


def build_catalog(
    *,
    payload: dict[str, Any],
    pool: dict[str, Any],
    candidate_pools: dict[str, Any] | None = None,
    catalog_root: Path,
    catalog_id: str,
    as_of: str,
    license_reference: str,
    set_current: bool,
) -> None:
    validate_identifier(catalog_id)
    validate_date(as_of)
    validate_rights(payload, license_reference)
    allowlist = validate_pool(pool)
    published_pools = validate_candidate_pools(
        candidate_pools or load_json(CANDIDATE_POOLS_PATH),
        {player["id"] for player in allowlist},
    )
    records = validate_coverage(payload, allowlist)
    destination = catalog_root / "data" / "catalogs" / catalog_id
    asset_destination = catalog_root / "assets" / "catalogs" / catalog_id / "players"
    if destination.exists() or asset_destination.exists():
        raise CatalogBuildError(
            f"Catalog {catalog_id} already exists and is immutable."
        )

    temporary_root = Path(tempfile.mkdtemp(prefix=f"blind50-{catalog_id}-"))
    try:
        temporary_data = temporary_root / "data"
        temporary_assets = temporary_root / "players"
        temporary_data.mkdir()
        temporary_assets.mkdir()
        normalized_players: list[dict[str, Any]] = []
        review_rows: list[dict[str, Any]] = []
        image_hashes: set[str] = set()
        for expected in allowlist:
            record = records[expected["id"]]
            player, review = normalize_player(
                record=record,
                expected=expected,
                catalog_id=catalog_id,
                as_of=as_of,
                provider_name=required_string(payload, "provider"),
            )
            image_path = temporary_assets / f"{expected['id']}.webp"
            convert_image(record, image_path)
            image_hash = sha256_file(image_path)
            if image_hash in image_hashes:
                raise CatalogBuildError(
                    f"Duplicate image content for {expected['id']}."
                )
            image_hashes.add(image_hash)
            normalized_players.append(player)
            review_rows.append(review)

        players_path = temporary_data / "players.json"
        write_json(
            players_path,
            {
                "catalog_id": catalog_id,
                "as_of": as_of,
                "sources": [
                    f"{required_string(payload, 'provider')} provider export.",
                    "Awards audited against official NBA records.",
                ],
                "players": normalized_players,
            },
        )
        pools_path = temporary_data / "pools.json"
        write_json(
            pools_path,
            {
                "catalog_id": catalog_id,
                "pools": published_pools,
            },
        )
        review_path = temporary_data / "review.csv"
        write_review_csv(review_path, review_rows)
        manifest = build_manifest(
            payload=payload,
            catalog_id=catalog_id,
            as_of=as_of,
            license_reference=license_reference,
            players_path=players_path,
            pools_path=pools_path,
            review_path=review_path,
            asset_directory=temporary_assets,
        )
        write_json(temporary_data / "manifest.json", manifest)

        destination.parent.mkdir(parents=True, exist_ok=True)
        asset_destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(temporary_data), str(destination))
        shutil.move(str(temporary_assets), str(asset_destination))
        if set_current:
            set_current_catalog(catalog_root, catalog_id)
    except Exception:
        if destination.exists():
            shutil.rmtree(destination)
        if asset_destination.exists():
            shutil.rmtree(asset_destination)
        raise
    finally:
        shutil.rmtree(temporary_root, ignore_errors=True)


def validate_pool(pool: dict[str, Any]) -> list[dict[str, str]]:
    players = pool.get("players")
    if (
        pool.get("player_count") != 100
        or not isinstance(players, list)
        or len(players) != 100
    ):
        raise CatalogBuildError("The beta allowlist must contain 100 players.")
    ids = [record.get("id") for record in players]
    names = [record.get("name") for record in players]
    if len(set(ids)) != 100 or len(set(names)) != 100:
        raise CatalogBuildError("Allowlist IDs and names must be unique.")
    if sum(record.get("cohort") == "nba-75" for record in players) != 76:
        raise CatalogBuildError("The allowlist must contain 76 NBA 75 players.")
    if sum(record.get("cohort") == "addition" for record in players) != 24:
        raise CatalogBuildError("The allowlist must contain 24 additions.")
    return players


def validate_candidate_pools(
    payload: dict[str, Any],
    player_ids: set[str],
) -> dict[str, list[str]]:
    raw_pools = payload.get("pools")
    if not isinstance(raw_pools, dict) or set(raw_pools) != {"25", "50", "100"}:
        raise CatalogBuildError("Candidate pools must define 25, 50, and 100.")

    pools: dict[str, list[str]] = {}
    for size in (25, 50, 100):
        key = str(size)
        values = raw_pools[key]
        if (
            not isinstance(values, list)
            or len(values) != size
            or any(not isinstance(value, str) for value in values)
            or len(set(values)) != size
        ):
            raise CatalogBuildError(
                f"Candidate pool {size} must contain {size} unique player IDs."
            )
        unknown = set(values) - player_ids
        if unknown:
            raise CatalogBuildError(
                f"Candidate pool {size} contains unknown IDs: {sorted(unknown)}."
            )
        pools[key] = values

    if set(pools["100"]) != player_ids:
        raise CatalogBuildError("Candidate pool 100 must contain every player.")
    if not set(pools["25"]) < set(pools["50"]) < set(pools["100"]):
        raise CatalogBuildError("Candidate pools must be strictly nested.")
    return pools


def validate_rights(
    payload: dict[str, Any],
    license_reference: str,
) -> None:
    provider = payload.get("provider")
    if provider not in SUPPORTED_PROVIDERS:
        raise CatalogBuildError(
            f"The provider must be one of {', '.join(SUPPORTED_PROVIDERS)}."
        )
    for key in ("provider_version", "extracted_at"):
        if not required_string(payload, key):
            raise CatalogBuildError(f"Provider export needs {key}.")
    if not license_reference.strip():
        raise CatalogBuildError("A written license reference is required.")
    rights = payload.get("rights_confirmation")
    if not isinstance(rights, dict):
        raise CatalogBuildError("Written rights confirmation is required.")
    if any(rights.get(key) is not True for key in REQUIRED_RIGHTS):
        raise CatalogBuildError(
            "Data, coverage, and local image rights must all be confirmed."
        )
    if not required_string(rights, "reference"):
        raise CatalogBuildError("Rights confirmation needs a reference.")


def validate_coverage(
    payload: dict[str, Any],
    allowlist: list[dict[str, str]],
) -> dict[str, dict[str, Any]]:
    records = payload.get("players")
    if not isinstance(records, list) or len(records) != 100:
        raise CatalogBuildError("Provider coverage must contain 100 players.")
    by_id: dict[str, dict[str, Any]] = {}
    provider_ids: set[str] = set()
    for record in records:
        if not isinstance(record, dict):
            raise CatalogBuildError("Every provider player must be an object.")
        player_id = required_string(record, "blind50_id")
        provider_id = required_string(record, "provider_id")
        if player_id in by_id:
            raise CatalogBuildError(f"Duplicate player ID: {player_id}.")
        if provider_id in provider_ids:
            raise CatalogBuildError(f"Duplicate provider ID: {provider_id}.")
        by_id[player_id] = record
        provider_ids.add(provider_id)
    expected_ids = {record["id"] for record in allowlist}
    if set(by_id) != expected_ids:
        missing = sorted(expected_ids - set(by_id))
        extra = sorted(set(by_id) - expected_ids)
        raise CatalogBuildError(f"Coverage mismatch; missing={missing}, extra={extra}.")
    return by_id


def normalize_player(
    *,
    record: dict[str, Any],
    expected: dict[str, str],
    catalog_id: str,
    as_of: str,
    provider_name: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    if required_string(record, "name") != expected["name"]:
        raise CatalogBuildError(f"Name mismatch for {expected['id']}.")
    career_start = positive_int(record, "career_start_year")
    career_end = positive_int(record, "career_end_year")
    if career_end < career_start:
        raise CatalogBuildError(f"Career dates are reversed for {expected['id']}.")
    seasons = positive_int(record, "seasons")
    regular_totals = totals(record, "regular_season_totals")
    playoff_totals = totals(record, "playoff_totals")
    regular_stats = normalize_stats(
        regular_totals,
        career_start=career_start,
        career_end=career_end,
        require_games=True,
    )
    playoff_stats = normalize_stats(
        playoff_totals,
        career_start=career_start,
        career_end=career_end,
        require_games=False,
    )
    honors = normalize_honors(
        record,
        career_end=career_end,
        player_id=expected["id"],
    )
    era = prominent_era(record, expected["id"])
    record_source = required_https_url(record, "record_source")
    award_source = required_https_url(record, "award_source")
    image_license = required_string(record, "image_license")
    image_url = f"/assets/catalogs/{catalog_id}/players/{expected['id']}.webp"
    player = {
        "id": expected["id"],
        "name": expected["name"],
        "era": era,
        "seasons": seasons,
        "regular_season": regular_stats,
        "playoffs": playoff_stats,
        "honors": honors,
        "image_path": image_url,
        "as_of": as_of,
        "source_note": (
            f"{provider_name} provider record; awards audited at {award_source}"
        ),
    }
    review = {
        "id": expected["id"],
        "provider_id": required_string(record, "provider_id"),
        "name": expected["name"],
        "era": era,
        "seasons": seasons,
        **flatten_stats("regular", regular_stats),
        **flatten_stats("playoff", playoff_stats),
        **honors,
        "award_source": award_source,
        "record_source": record_source,
        "image_license": image_license,
    }
    return player, review


def totals(record: dict[str, Any], key: str) -> dict[str, int | None]:
    value = record.get(key)
    if not isinstance(value, dict):
        raise CatalogBuildError(f"{key} must be an object.")
    result: dict[str, int | None] = {}
    for field in TOTAL_FIELDS:
        if field not in value:
            raise CatalogBuildError(f"{key}.{field} is required.")
        raw_value = value[field]
        if raw_value is None:
            result[field] = None
        elif (
            not isinstance(raw_value, int)
            or isinstance(raw_value, bool)
            or raw_value < 0
        ):
            raise CatalogBuildError(
                f"{key}.{field} must be a non-negative integer or null."
            )
        else:
            result[field] = raw_value
    return result


def normalize_stats(
    values: dict[str, int | None],
    *,
    career_start: int,
    career_end: int,
    require_games: bool,
) -> dict[str, int | float | None]:
    games = values["games"]
    if not isinstance(games, int) or (require_games and games == 0):
        raise CatalogBuildError("Career games are invalid.")
    assert isinstance(games, int)
    stats: dict[str, int | float | None] = {
        "games": games,
        "ppg": per_game(values["points"], games),
        "rpg": per_game(values["rebounds"], games),
        "apg": per_game(values["assists"], games),
        "spg": per_game(values["steals"], games),
        "bpg": per_game(values["blocks"], games),
        "fg_pct": percentage(
            values["field_goals_made"],
            values["field_goals_attempted"],
        ),
        "three_pct": percentage(
            values["three_points_made"],
            values["three_points_attempted"],
        ),
        "ft_pct": percentage(
            values["free_throws_made"],
            values["free_throws_attempted"],
        ),
    }
    if career_start < 1974:
        if values["steals"] is not None or values["blocks"] is not None:
            raise CatalogBuildError("Incomplete-career steals and blocks must be null.")
        stats["spg"] = None
        stats["bpg"] = None
    if career_end < 1980:
        if (
            values["three_points_made"] is not None
            or values["three_points_attempted"] is not None
        ):
            raise CatalogBuildError(
                "Pre-three-point careers must use null three-point totals."
            )
        stats["three_pct"] = None
    return stats


def normalize_honors(
    record: dict[str, Any],
    *,
    career_end: int,
    player_id: str,
) -> dict[str, int | None]:
    provider = record.get("honors")
    audit = record.get("award_audit")
    if not isinstance(provider, dict) or not isinstance(audit, dict):
        raise CatalogBuildError(f"Award audit missing for {player_id}.")
    result: dict[str, int | None] = {}
    for key in COUNT_FIELDS:
        result[key] = non_negative_int(provider, key)
    for key in NULLABLE_COUNT_FIELDS:
        result[key] = nullable_non_negative_int(provider, key)
    if career_end < 1983:
        if result["dpoy"] is not None:
            raise CatalogBuildError(f"DPOY must be null for {player_id}.")
    elif result["dpoy"] is None:
        raise CatalogBuildError(f"DPOY must be numeric for {player_id}.")
    if career_end < 1969:
        if result["finals_mvp"] is not None:
            raise CatalogBuildError(f"Finals MVP must be null for {player_id}.")
    elif result["finals_mvp"] is None:
        raise CatalogBuildError(f"Finals MVP must be numeric for {player_id}.")
    if (
        result["finals_mvp"] is not None
        and result["finals_mvp"] > result["championships"]
    ):
        raise CatalogBuildError(f"Finals MVP exceeds championships for {player_id}.")
    if audit != result:
        raise CatalogBuildError(
            f"Provider awards disagree with NBA audit for {player_id}."
        )
    return result


def prominent_era(record: dict[str, Any], player_id: str) -> str:
    seasons = record.get("regular_seasons")
    if not isinstance(seasons, list) or not seasons:
        raise CatalogBuildError(f"Season history missing for {player_id}.")
    games_by_decade: dict[int, int] = defaultdict(int)
    minutes_by_decade: dict[int, int] = defaultdict(int)
    for season in seasons:
        if not isinstance(season, dict):
            raise CatalogBuildError(f"Invalid season row for {player_id}.")
        year = positive_int(season, "season_start_year")
        games = non_negative_int(season, "games")
        minutes = non_negative_int(season, "minutes")
        decade = year // 10 * 10
        games_by_decade[decade] += games
        minutes_by_decade[decade] += minutes
    decade = max(
        games_by_decade,
        key=lambda value: (
            games_by_decade[value],
            minutes_by_decade[value],
            value,
        ),
    )
    return f"{decade}s"


def convert_image(record: dict[str, Any], destination: Path) -> None:
    image_license = required_string(record, "image_license")
    if not image_license.strip():
        raise CatalogBuildError("Every image needs a license reference.")
    source_bytes = read_image_bytes(record)
    try:
        with Image.open(io.BytesIO(source_bytes)) as source:
            source.load()
            image = source.convert("RGBA")
    except (UnidentifiedImageError, OSError) as error:
        raise CatalogBuildError("Player image is corrupt.") from error
    if image.width < 200 or image.height < 200:
        raise CatalogBuildError("Player image is undersized.")
    image.thumbnail(IMAGE_SIZE, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", IMAGE_SIZE, (0, 0, 0, 0))
    position = (
        (IMAGE_SIZE[0] - image.width) // 2,
        (IMAGE_SIZE[1] - image.height) // 2,
    )
    canvas.alpha_composite(image, position)
    canvas.save(destination, format="WEBP", quality=90, method=6)


def read_image_bytes(record: dict[str, Any]) -> bytes:
    image_file = record.get("image_file")
    image_url = record.get("image_url")
    if isinstance(image_file, str) and image_file:
        try:
            return Path(image_file).read_bytes()
        except OSError as error:
            raise CatalogBuildError("Licensed local image is unavailable.") from error
    if not isinstance(image_url, str) or not image_url.startswith("https://"):
        raise CatalogBuildError(
            "Every player needs a licensed HTTPS image URL or local file."
        )
    headers = {"User-Agent": "AllTime25CatalogBuilder/1.0"}
    api_key = os.environ.get("SPORTSDATAIO_API_KEY")
    if api_key:
        headers["Ocp-Apim-Subscription-Key"] = api_key
    request = urllib.request.Request(image_url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.read()
    except OSError as error:
        raise CatalogBuildError("Licensed image download failed.") from error


def build_manifest(
    *,
    payload: dict[str, Any],
    catalog_id: str,
    as_of: str,
    license_reference: str,
    players_path: Path,
    pools_path: Path,
    review_path: Path,
    asset_directory: Path,
) -> dict[str, Any]:
    assets = {
        path.name: sha256_file(path) for path in sorted(asset_directory.glob("*.webp"))
    }
    if len(assets) != 100:
        raise CatalogBuildError("Publication requires 100 WebP images.")
    return {
        "catalog_id": catalog_id,
        "as_of": as_of,
        "player_count": 100,
        "provider": required_string(payload, "provider"),
        "provider_version": required_string(payload, "provider_version"),
        "provider_extracted_at": required_string(payload, "extracted_at"),
        "built_at": datetime.now(UTC).isoformat(),
        "source_references": [
            required_string(payload, "coverage_reference"),
            "https://www.nba.com/news/history-all-time-awards",
            "https://www.nba.com/stats/alltime?PerMode=PerGame",
        ],
        "license_reference": license_reference,
        "hashes": {
            "players.json": sha256_file(players_path),
            "pools.json": sha256_file(pools_path),
            "review.csv": sha256_file(review_path),
            "assets": assets,
        },
    }


def verify_manifest(catalog_root: Path, catalog_id: str) -> None:
    validate_identifier(catalog_id)
    data_directory = catalog_root / "data" / "catalogs" / catalog_id
    asset_directory = catalog_root / "assets" / "catalogs" / catalog_id / "players"
    manifest = load_json(data_directory / "manifest.json")
    if manifest.get("catalog_id") != catalog_id:
        raise CatalogBuildError("Manifest catalog ID does not match its directory.")
    if manifest.get("player_count") != 100:
        raise CatalogBuildError("Manifest must declare exactly 100 players.")
    hashes = manifest.get("hashes")
    if not isinstance(hashes, dict):
        raise CatalogBuildError("Manifest hashes are missing.")

    for filename in ("players.json", "pools.json", "review.csv"):
        expected = hashes.get(filename)
        path = data_directory / filename
        if not isinstance(expected, str) or sha256_file(path) != expected:
            raise CatalogBuildError(f"{filename} hash does not match the manifest.")

    expected_assets = hashes.get("assets")
    if not isinstance(expected_assets, dict) or len(expected_assets) != 100:
        raise CatalogBuildError("Manifest must contain 100 asset hashes.")
    actual_names = {path.name for path in asset_directory.glob("*.webp")}
    if actual_names != set(expected_assets):
        raise CatalogBuildError("Manifest asset list does not match the catalog.")
    for filename, expected in expected_assets.items():
        if (
            not isinstance(filename, str)
            or Path(filename).name != filename
            or not isinstance(expected, str)
            or sha256_file(asset_directory / filename) != expected
        ):
            raise CatalogBuildError(f"{filename} hash does not match the manifest.")


def write_review_csv(
    path: Path,
    rows: list[dict[str, Any]],
) -> None:
    with path.open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=REVIEW_FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def set_current_catalog(catalog_root: Path, catalog_id: str) -> None:
    pointer_directory = catalog_root / "data"
    pointer_directory.mkdir(parents=True, exist_ok=True)
    temporary = pointer_directory / ".current.json.tmp"
    write_json(temporary, {"catalog_id": catalog_id})
    os.replace(temporary, pointer_directory / "current.json")


def flatten_stats(
    prefix: str,
    stats: dict[str, int | float | None],
) -> dict[str, int | float | None]:
    return {
        f"{prefix}_games": stats["games"],
        f"{prefix}_ppg": stats["ppg"],
        f"{prefix}_rpg": stats["rpg"],
        f"{prefix}_apg": stats["apg"],
        f"{prefix}_spg": stats["spg"],
        f"{prefix}_bpg": stats["bpg"],
        f"{prefix}_fg_pct": stats["fg_pct"],
        f"{prefix}_three_pct": stats["three_pct"],
        f"{prefix}_ft_pct": stats["ft_pct"],
    }


def per_game(total: int | None, games: int) -> float | None:
    if total is None:
        return None
    if games == 0:
        return None
    return round(total / games, 1)


def percentage(made: int | None, attempted: int | None) -> float | None:
    if made is None or attempted is None:
        if made is not None or attempted is not None:
            raise CatalogBuildError(
                "Made and attempted totals must both be null or numeric."
            )
        return None
    if made > attempted:
        raise CatalogBuildError("Made total cannot exceed attempts.")
    if attempted == 0:
        return None
    value = round(made / attempted * 100, 1)
    if not math.isfinite(value):
        raise CatalogBuildError("Percentage is not finite.")
    return value


def positive_int(record: dict[str, Any], key: str) -> int:
    value = record.get(key)
    if not isinstance(value, int) or isinstance(value, bool) or value < 1:
        raise CatalogBuildError(f"{key} must be a positive integer.")
    return value


def non_negative_int(record: dict[str, Any], key: str) -> int:
    value = record.get(key)
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise CatalogBuildError(f"{key} must be a non-negative integer.")
    return value


def nullable_non_negative_int(
    record: dict[str, Any],
    key: str,
) -> int | None:
    if key not in record:
        raise CatalogBuildError(f"{key} is required.")
    value = record[key]
    if value is None:
        return None
    return non_negative_int(record, key)


def required_string(record: dict[str, Any], key: str) -> str:
    value = record.get(key)
    if not isinstance(value, str) or not value.strip():
        raise CatalogBuildError(f"{key} must be a non-empty string.")
    return value


def required_https_url(record: dict[str, Any], key: str) -> str:
    value = required_string(record, key)
    if not value.startswith("https://"):
        raise CatalogBuildError(f"{key} must be an HTTPS URL.")
    return value


def validate_identifier(value: str) -> None:
    if (
        not value
        or len(value) > 128
        or not value[0].isalnum()
        or any(
            character not in "abcdefghijklmnopqrstuvwxyz0123456789-"
            for character in value
        )
    ):
        raise CatalogBuildError("Catalog ID has an invalid format.")


def validate_date(value: str) -> None:
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError as error:
        raise CatalogBuildError("as_of must use YYYY-MM-DD.") from error


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise CatalogBuildError(f"Cannot read JSON from {path}.") from error
    if not isinstance(value, dict):
        raise CatalogBuildError(f"{path} must contain a JSON object.")
    return value


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(
            value,
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    raise SystemExit(main())
