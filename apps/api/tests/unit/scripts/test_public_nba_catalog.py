from __future__ import annotations

from pathlib import Path

from scripts.catalog.build_catalog import PLAYER_POOL_PATH, load_json
from scripts.catalog.fetch_public_nba_catalog import (
    build_player_record,
    normalize_name,
    player_index,
    selected_season_rows,
)


def test_static_nba_player_index_covers_the_frozen_pool() -> None:
    provider_players = player_index()
    expected_players = load_json(PLAYER_POOL_PATH)["players"]

    missing = [
        player["name"]
        for player in expected_players
        if normalize_name(player["name"]) not in provider_players
    ]

    assert missing == []


def test_traded_season_uses_the_total_row_once() -> None:
    rows = [
        season_row("2025-26", "LAC", games=44, points=900),
        season_row("2025-26", "CLE", games=26, points=600),
        season_row("2025-26", "TOT", games=70, points=1500),
    ]

    selected = selected_season_rows(rows)

    assert len(selected) == 1
    assert selected[0]["TEAM_ABBREVIATION"] == "TOT"
    assert selected[0]["GP"] == 70


def test_player_record_normalizes_stats_awards_and_sources(
    tmp_path: Path,
) -> None:
    career = {
        "resultSets": [
            result_set(
                "SeasonTotalsRegularSeason",
                [
                    season_row("1999-00", "AAA", games=80, points=1600),
                    season_row("2000-01", "AAA", games=82, points=1800),
                ],
            ),
            result_set(
                "SeasonTotalsPostSeason",
                [season_row("2000-01", "AAA", games=10, points=250)],
            ),
        ]
    }
    awards = {
        "resultSets": [
            result_set(
                "PlayerAwards",
                [
                    {"DESCRIPTION": "NBA Most Valuable Player"},
                    {"DESCRIPTION": "All-NBA"},
                    {"DESCRIPTION": "All-NBA"},
                    {"DESCRIPTION": "NBA Champion"},
                    {"DESCRIPTION": "NBA Finals Most Valuable Player"},
                ],
            )
        ]
    }

    record = build_player_record(
        expected={"id": "player-test", "name": "Player Test"},
        provider_id=123,
        career=career,
        awards=awards,
        image_path=tmp_path / "123.png",
        image_license="NBA.com CDN public-source development import.",
    )

    assert record["seasons"] == 2
    assert record["regular_season_totals"]["games"] == 162
    assert record["regular_season_totals"]["points"] == 3400
    assert record["playoff_totals"]["games"] == 10
    assert record["honors"] == {
        "mvp": 1,
        "all_nba": 2,
        "dpoy": 0,
        "championships": 1,
        "finals_mvp": 1,
    }
    assert record["award_audit"] == record["honors"]
    assert record["record_source"].startswith("https://www.nba.com/stats/player/123")
    assert record["award_source"].endswith("/awards")


def result_set(
    name: str,
    rows: list[dict[str, object]],
) -> dict[str, object]:
    headers = list(rows[0]) if rows else []
    return {
        "name": name,
        "headers": headers,
        "rowSet": [[row[header] for header in headers] for row in rows],
    }


def season_row(
    season_id: str,
    team: str,
    *,
    games: int,
    points: int,
) -> dict[str, object]:
    return {
        "PLAYER_ID": 123,
        "SEASON_ID": season_id,
        "LEAGUE_ID": "00",
        "TEAM_ID": 1,
        "TEAM_ABBREVIATION": team,
        "GP": games,
        "MIN": games * 30,
        "FGM": points // 3,
        "FGA": points // 2,
        "FG3M": points // 20,
        "FG3A": points // 10,
        "FTM": points // 5,
        "FTA": points // 4,
        "REB": games * 5,
        "AST": games * 4,
        "STL": games,
        "BLK": games // 2,
        "PTS": points,
    }
