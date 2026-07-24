from __future__ import annotations

import json
from pathlib import Path

import pytest
from PIL import Image
from scripts.catalog.build_catalog import (
    CatalogBuildError,
    build_catalog,
    load_json,
    per_game,
    percentage,
    prominent_era,
    validate_pool,
    verify_manifest,
)

PLAYER_POOL_PATH = (
    Path(__file__).resolve().parents[5] / "scripts" / "catalog" / "player_pool.json"
)


def test_frozen_pool_has_exact_required_cohorts() -> None:
    players = validate_pool(load_json(PLAYER_POOL_PATH))

    assert len(players) == 100
    assert sum(player["cohort"] == "nba-75" for player in players) == 76
    assert sum(player["cohort"] == "addition" for player in players) == 24


def test_career_rates_are_calculated_from_totals() -> None:
    assert per_game(101, 8) == 12.6
    assert percentage(37, 100) == 37.0


def test_percentage_rejects_partial_or_impossible_totals() -> None:
    with pytest.raises(CatalogBuildError, match="both be null"):
        percentage(1, None)
    with pytest.raises(CatalogBuildError, match="exceed"):
        percentage(11, 10)


def test_prominent_era_ties_break_by_minutes_then_later_decade() -> None:
    player = {
        "regular_seasons": [
            {"season_start_year": 1999, "games": 50, "minutes": 1000},
            {"season_start_year": 2000, "games": 50, "minutes": 1100},
        ]
    }
    assert prominent_era(player, "player") == "2000s"

    player["regular_seasons"][0]["minutes"] = 1100
    assert prominent_era(player, "player") == "2000s"


def test_full_builder_publishes_exactly_one_hundred_hashed_assets(
    tmp_path: Path,
) -> None:
    pool = load_json(PLAYER_POOL_PATH)
    source_directory = tmp_path / "licensed-images"
    source_directory.mkdir()
    records = []
    for index, expected in enumerate(pool["players"]):
        image_path = source_directory / f"{expected['id']}.png"
        Image.new(
            "RGB",
            (200, 200),
            (
                index * 31 % 256,
                index * 67 % 256,
                index * 97 % 256,
            ),
        ).save(image_path)
        honors = {
            "mvp": 0,
            "all_nba": 0,
            "dpoy": 0,
            "championships": 0,
            "finals_mvp": 0,
        }
        records.append(
            {
                "blind50_id": expected["id"],
                "provider_id": f"provider-{index}",
                "name": expected["name"],
                "career_start_year": 2000,
                "career_end_year": 2010,
                "seasons": 10,
                "regular_season_totals": totals(games=100),
                "playoff_totals": totals(games=10),
                "regular_seasons": [
                    {
                        "season_start_year": 2000,
                        "games": 100,
                        "minutes": 3000,
                    }
                ],
                "honors": honors,
                "award_audit": honors,
                "record_source": "https://sportsdata.io/record",
                "award_source": "https://www.nba.com/awards",
                "image_file": str(image_path),
                "image_license": "licensed-test-image",
            }
        )
    payload = {
        "provider": "SportsDataIO",
        "provider_version": "test-export-v1",
        "extracted_at": "2026-07-23T12:00:00Z",
        "coverage_reference": "licensed-coverage-audit",
        "rights_confirmation": {
            "historical_data_display": True,
            "local_image_caching": True,
            "all_player_coverage": True,
            "reference": "written-test-confirmation",
        },
        "players": records,
    }
    catalog_root = tmp_path / "catalog"

    build_catalog(
        payload=payload,
        pool=pool,
        catalog_root=catalog_root,
        catalog_id="beta-test-2025-26",
        as_of="2026-06-30",
        license_reference="written-license-test",
        set_current=True,
    )

    data_directory = catalog_root / "data" / "catalogs" / "beta-test-2025-26"
    manifest = json.loads(
        (data_directory / "manifest.json").read_text(encoding="utf-8")
    )
    review_rows = (
        (data_directory / "review.csv").read_text(encoding="utf-8").splitlines()
    )
    assert manifest["player_count"] == 100
    assert len(manifest["hashes"]["assets"]) == 100
    assert len(review_rows) == 101
    assert (
        len(
            list(
                (
                    catalog_root
                    / "assets"
                    / "catalogs"
                    / "beta-test-2025-26"
                    / "players"
                ).glob("*.webp")
            )
        )
        == 100
    )
    assert json.loads(
        (catalog_root / "data" / "current.json").read_text(encoding="utf-8")
    ) == {"catalog_id": "beta-test-2025-26"}

    verify_manifest(catalog_root, "beta-test-2025-26")
    asset = next(
        (catalog_root / "assets" / "catalogs" / "beta-test-2025-26" / "players").glob(
            "*.webp"
        )
    )
    asset.write_bytes(b"tampered")
    with pytest.raises(CatalogBuildError, match="hash"):
        verify_manifest(catalog_root, "beta-test-2025-26")


def totals(*, games: int) -> dict[str, int]:
    return {
        "games": games,
        "points": games * 20,
        "rebounds": games * 5,
        "assists": games * 4,
        "steals": games,
        "blocks": games,
        "field_goals_made": games * 8,
        "field_goals_attempted": games * 16,
        "three_points_made": games * 2,
        "three_points_attempted": games * 5,
        "free_throws_made": games * 2,
        "free_throws_attempted": games * 3,
    }
