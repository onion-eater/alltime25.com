from __future__ import annotations

import argparse
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from collections.abc import Callable
from datetime import UTC, datetime
from importlib.metadata import version
from pathlib import Path
from typing import Any

from nba_api.stats.endpoints import playerawards, playercareerstats
from nba_api.stats.static import players as nba_players

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPOSITORY_ROOT))

from scripts.catalog.build_catalog import (  # noqa: E402
    CANDIDATE_POOLS_PATH,
    DEFAULT_CATALOG_ROOT,
    PLAYER_POOL_PATH,
    CatalogBuildError,
    build_catalog,
    load_json,
    write_json,
)

DEFAULT_CACHE_ROOT = REPOSITORY_ROOT / ".catalog-cache" / "nba-public"
NBA_HEADSHOT_URL = "https://cdn.nba.com/headshots/nba/latest/1040x760/{player_id}.png"
WIKIMEDIA_FILE_URL = (
    "https://commons.wikimedia.org/wiki/Special:Redirect/file/{filename}"
)
PORTRAIT_FALLBACKS = {
    467: {
        "filename": "Jasonk1.jpg",
        "license": (
            "Wikimedia Commons public domain; Mwinog2777; "
            "https://commons.wikimedia.org/wiki/File:Jasonk1.jpg"
        ),
    },
    76673: {
        "filename": "Alex English, Visitante Ilustre (14935074624) (cropped).jpg",
        "license": (
            "Wikimedia Commons public domain, U.S. Department of State; "
            "https://commons.wikimedia.org/wiki/"
            "File:Alex_English,_Visitante_Ilustre_(14935074624)_(cropped).jpg"
        ),
    },
    77626: {
        "filename": "Sidney Moncrief 2015.jpg",
        "license": (
            "Wikimedia Commons public domain, U.S. Department of Veterans Affairs; "
            "https://commons.wikimedia.org/wiki/File:Sidney_Moncrief_2015.jpg"
        ),
    },
    78530: {
        "filename": "Lenny Wilkens 1968 (cropped).jpeg",
        "license": (
            "Wikimedia Commons public domain in the United States; Malcolm Emmons; "
            "https://commons.wikimedia.org/wiki/File:Lenny_Wilkens_1968_(cropped).jpeg"
        ),
    },
    121: {
        "filename": "Patrick Ewing ca. 1995 cropped.jpg",
        "license": (
            "Wikimedia Commons CC BY-SA 3.0; Seidenstud; cropped from the original; "
            "https://commons.wikimedia.org/wiki/"
            "File:Patrick_Ewing_ca._1995_cropped.jpg"
        ),
    },
}
NBA_PLAYER_ID_OVERRIDES = {
    "patrickewing": 121,
}
NBA_STAT_FIELDS = {
    "games": "GP",
    "points": "PTS",
    "rebounds": "REB",
    "assists": "AST",
    "steals": "STL",
    "blocks": "BLK",
    "field_goals_made": "FGM",
    "field_goals_attempted": "FGA",
    "three_points_made": "FG3M",
    "three_points_attempted": "FG3A",
    "free_throws_made": "FTM",
    "free_throws_attempted": "FTA",
}
AWARD_DESCRIPTIONS = {
    "mvp": "NBA Most Valuable Player",
    "all_nba": "All-NBA",
    "dpoy": "NBA Defensive Player of the Year",
    "championships": "NBA Champion",
    "finals_mvp": "NBA Finals Most Valuable Player",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a 100-player catalog from public NBA.com sources."
    )
    parser.add_argument("--catalog-id", required=True)
    parser.add_argument("--as-of", required=True)
    parser.add_argument(
        "--catalog-root",
        type=Path,
        default=DEFAULT_CATALOG_ROOT,
    )
    parser.add_argument(
        "--cache-root",
        type=Path,
        default=DEFAULT_CACHE_ROOT,
    )
    parser.add_argument(
        "--license-reference",
        default="Project owner-approved public-source development catalog.",
    )
    parser.add_argument("--request-delay", type=float, default=0.1)
    parser.add_argument("--set-current", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.request_delay < 0:
        raise CatalogBuildError("Request delay cannot be negative.")
    pool = load_json(PLAYER_POOL_PATH)
    candidate_pools = load_json(CANDIDATE_POOLS_PATH)
    expected_players = pool["players"]
    provider_players = player_index()
    args.cache_root.mkdir(parents=True, exist_ok=True)

    records: list[dict[str, Any]] = []
    for index, expected in enumerate(expected_players, start=1):
        provider = provider_players.get(normalize_name(expected["name"]))
        if provider is None:
            raise CatalogBuildError(
                f"NBA.com player ID is unavailable for {expected['name']}."
            )
        print(f"[{index:03d}/100] {expected['name']}", flush=True)
        player_id = int(provider["id"])
        career = cached_json(
            args.cache_root / "career" / f"{player_id}.json",
            lambda player_id=player_id: playercareerstats.PlayerCareerStats(
                player_id=player_id,
                timeout=30,
            ).get_dict(),
            request_delay=args.request_delay,
        )
        awards = cached_json(
            args.cache_root / "awards" / f"{player_id}.json",
            lambda player_id=player_id: playerawards.PlayerAwards(
                player_id=player_id,
                timeout=30,
            ).get_dict(),
            request_delay=args.request_delay,
        )
        image_path, image_license = fetch_portrait(
            player_id,
            cache_root=args.cache_root,
            request_delay=args.request_delay,
        )
        records.append(
            build_player_record(
                expected=expected,
                provider_id=player_id,
                career=career,
                awards=awards,
                image_path=image_path,
                image_license=image_license,
            )
        )

    extracted_at = datetime.now(UTC).isoformat()
    payload = {
        "provider": "NBA.com",
        "provider_version": f"NBA.com Stats via nba_api {version('nba_api')}",
        "extracted_at": extracted_at,
        "coverage_reference": "https://www.nba.com/stats/players/traditional",
        "rights_confirmation": {
            "historical_data_display": True,
            "local_image_caching": True,
            "all_player_coverage": True,
            "reference": args.license_reference,
        },
        "players": records,
    }
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
    print(f"Published public NBA.com catalog {args.catalog_id}.")
    return 0


def player_index() -> dict[str, dict[str, Any]]:
    provider_players = nba_players.get_players()
    indexed_players = {
        normalize_name(player["full_name"]): player for player in provider_players
    }
    players_by_id = {int(player["id"]): player for player in provider_players}
    for normalized_name, player_id in NBA_PLAYER_ID_OVERRIDES.items():
        indexed_players[normalized_name] = players_by_id[player_id]
    return indexed_players


def normalize_name(value: str) -> str:
    ascii_value = (
        unicodedata.normalize("NFKD", value)
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
    )
    return re.sub(r"[^a-z0-9]+", "", ascii_value)


def cached_json(
    path: Path,
    fetch: Callable[[], dict[str, Any]],
    *,
    request_delay: float,
) -> dict[str, Any]:
    if path.is_file():
        return load_json(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    value = retry(fetch)
    write_json(path, value)
    if request_delay:
        time.sleep(request_delay)
    return value


def cached_image(
    path: Path,
    url: str,
    *,
    request_delay: float,
) -> Path:
    if path.is_file() and path.stat().st_size > 0:
        return path
    path.parent.mkdir(parents=True, exist_ok=True)

    def download() -> bytes:
        request = urllib.request.Request(
            url,
            headers={
                "Referer": "https://www.nba.com/",
                "User-Agent": "AllTime25PublicCatalog/1.0",
            },
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.read()

    content = retry(download)
    temporary = path.with_suffix(".tmp")
    temporary.write_bytes(content)
    os.replace(temporary, path)
    if request_delay:
        time.sleep(request_delay)
    return path


def fetch_portrait(
    player_id: int,
    *,
    cache_root: Path,
    request_delay: float,
) -> tuple[Path, str]:
    fallback = PORTRAIT_FALLBACKS.get(player_id)
    if fallback is None:
        return (
            cached_image(
                cache_root / "images" / f"{player_id}.png",
                NBA_HEADSHOT_URL.format(player_id=player_id),
                request_delay=request_delay,
            ),
            "NBA.com CDN public-source development import.",
        )
    filename = str(fallback["filename"])
    return (
        cached_image(
            cache_root / "images" / f"{player_id}-wikimedia",
            WIKIMEDIA_FILE_URL.format(filename=urllib.parse.quote(filename)),
            request_delay=request_delay,
        ),
        str(fallback["license"]),
    )


def retry(action: Callable[[], Any]) -> Any:
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            return action()
        except Exception as error:
            last_error = error
            if attempt < 2:
                time.sleep(2**attempt)
    raise CatalogBuildError(
        "NBA.com source request failed after three attempts."
    ) from last_error


def build_player_record(
    *,
    expected: dict[str, str],
    provider_id: int,
    career: dict[str, Any],
    awards: dict[str, Any],
    image_path: Path,
    image_license: str,
) -> dict[str, Any]:
    regular_rows = selected_season_rows(
        result_rows(career, "SeasonTotalsRegularSeason")
    )
    if not regular_rows:
        raise CatalogBuildError(f"Regular-season data is missing for {expected['id']}.")
    playoff_rows = selected_season_rows(result_rows(career, "SeasonTotalsPostSeason"))
    season_years = [season_start_year(row) for row in regular_rows]
    career_start = min(season_years)
    career_end = max(season_years) + 1
    honors = normalized_honors(
        result_rows(awards, "PlayerAwards"),
        career_end=career_end,
    )
    player_url = f"https://www.nba.com/stats/player/{provider_id}"
    return {
        "blind50_id": expected["id"],
        "provider_id": str(provider_id),
        "name": expected["name"],
        "career_start_year": career_start,
        "career_end_year": career_end,
        "seasons": len(regular_rows),
        "regular_season_totals": aggregate_totals(
            regular_rows,
            career_start=career_start,
            career_end=career_end,
        ),
        "playoff_totals": aggregate_totals(
            playoff_rows,
            career_start=career_start,
            career_end=career_end,
        ),
        "regular_seasons": [
            {
                "season_start_year": season_start_year(row),
                "games": integer_value(row.get("GP")),
                "minutes": integer_value(row.get("MIN")),
            }
            for row in regular_rows
        ],
        "honors": honors,
        "award_audit": honors,
        "record_source": f"{player_url}/traditional?PerMode=Totals",
        "award_source": f"{player_url}/awards",
        "image_file": str(image_path.resolve()),
        "image_license": image_license,
    }


def result_rows(payload: dict[str, Any], name: str) -> list[dict[str, Any]]:
    result_sets = payload.get("resultSets")
    if not isinstance(result_sets, list):
        raise CatalogBuildError("NBA.com response is missing result sets.")
    for result_set in result_sets:
        if not isinstance(result_set, dict) or result_set.get("name") != name:
            continue
        headers = result_set.get("headers")
        rows = result_set.get("rowSet")
        if not isinstance(headers, list) or not isinstance(rows, list):
            raise CatalogBuildError(f"NBA.com result set {name} is malformed.")
        return [dict(zip(headers, row, strict=True)) for row in rows]
    raise CatalogBuildError(f"NBA.com result set {name} is unavailable.")


def selected_season_rows(
    rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    by_season: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        if row.get("LEAGUE_ID") == "00":
            by_season[str(row["SEASON_ID"])].append(row)

    selected: list[dict[str, Any]] = []
    for season_id in sorted(by_season):
        season_rows = by_season[season_id]
        total_rows = [
            row for row in season_rows if row.get("TEAM_ABBREVIATION") == "TOT"
        ]
        if len(total_rows) == 1:
            selected.append(total_rows[0])
        elif len(season_rows) == 1:
            selected.append(season_rows[0])
        else:
            selected.append(merge_season_rows(season_id, season_rows))
    return selected


def merge_season_rows(
    season_id: str,
    rows: list[dict[str, Any]],
) -> dict[str, Any]:
    merged = {
        "SEASON_ID": season_id,
        "LEAGUE_ID": "00",
        "TEAM_ABBREVIATION": "TOT",
    }
    for field in (*NBA_STAT_FIELDS.values(), "MIN"):
        merged[field] = sum(numeric_value(row.get(field)) for row in rows)
    return merged


def aggregate_totals(
    rows: list[dict[str, Any]],
    *,
    career_start: int,
    career_end: int,
) -> dict[str, int | None]:
    totals = {
        field: sum(integer_value(row.get(nba_field)) for row in rows)
        for field, nba_field in NBA_STAT_FIELDS.items()
    }
    if career_start < 1974:
        totals["steals"] = None
        totals["blocks"] = None
    if career_end < 1980:
        totals["three_points_made"] = None
        totals["three_points_attempted"] = None
    return totals


def normalized_honors(
    rows: list[dict[str, Any]],
    *,
    career_end: int,
) -> dict[str, int | None]:
    counts = Counter(str(row.get("DESCRIPTION")) for row in rows)
    return {
        "mvp": counts[AWARD_DESCRIPTIONS["mvp"]],
        "all_nba": counts[AWARD_DESCRIPTIONS["all_nba"]],
        "dpoy": (counts[AWARD_DESCRIPTIONS["dpoy"]] if career_end >= 1983 else None),
        "championships": counts[AWARD_DESCRIPTIONS["championships"]],
        "finals_mvp": (
            counts[AWARD_DESCRIPTIONS["finals_mvp"]] if career_end >= 1969 else None
        ),
    }


def season_start_year(row: dict[str, Any]) -> int:
    season_id = row.get("SEASON_ID")
    if not isinstance(season_id, str) or not re.fullmatch(r"\d{4}-\d{2}", season_id):
        raise CatalogBuildError("NBA.com season ID is invalid.")
    return int(season_id[:4])


def integer_value(value: Any) -> int:
    return int(round(numeric_value(value)))


def numeric_value(value: Any) -> float:
    if value is None:
        return 0
    if not isinstance(value, int | float) or isinstance(value, bool) or value < 0:
        raise CatalogBuildError("NBA.com returned an invalid numeric value.")
    return float(value)


if __name__ == "__main__":
    raise SystemExit(main())
