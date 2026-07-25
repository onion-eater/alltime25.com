from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from alltime25.infrastructure.catalog.json_catalog_registry import (
    JsonCatalogRegistry,
)
from alltime25.infrastructure.catalog.json_player_catalog import JsonPlayerCatalog


def player_record(player_id: str = "player-one") -> dict[str, Any]:
    stats = {
        "games": 100,
        "ppg": 20.0,
        "rpg": 5.0,
        "apg": 5.0,
        "spg": 1.0,
        "bpg": 1.0,
        "fg_pct": 50.0,
        "three_pct": 35.0,
        "ft_pct": 80.0,
    }
    return {
        "id": player_id,
        "name": "Player One",
        "era": "2000s",
        "seasons": 10,
        "regular_season": stats,
        "playoffs": stats,
        "honors": {
            "mvp": 1,
            "all_nba": 2,
            "dpoy": 0,
            "championships": 1,
            "finals_mvp": 1,
        },
        "image_path": ("/assets/catalogs/test-2024-06-18/players/player.jpg"),
        "as_of": "2024-06-18",
        "source_note": "Test source.",
    }


def write_catalog(
    tmp_path: Path,
    players: list[dict[str, Any]],
    pools: dict[str, list[str]] | None = None,
) -> tuple[Path, Path]:
    assets = tmp_path / "assets"
    assets.mkdir()
    for player in players:
        image_name = Path(player["image_path"]).name
        (assets / image_name).write_bytes(f"image:{image_name}".encode())
    catalog = tmp_path / "players.json"
    catalog.write_text(
        json.dumps(
            {
                "catalog_id": "test-2024-06-18",
                "as_of": "2024-06-18",
                "players": players,
            }
        ),
        encoding="utf-8",
    )
    if pools is not None:
        (tmp_path / "pools.json").write_text(
            json.dumps(
                {
                    "catalog_id": "test-2024-06-18",
                    "pools": pools,
                }
            ),
            encoding="utf-8",
        )
    return catalog, assets


def write_registry(
    tmp_path: Path,
    *,
    pointer_id: str = "test-2024-06-18",
    payload_id: str = "test-2024-06-18",
) -> Path:
    catalog_root = tmp_path / "catalog"
    data_directory = catalog_root / "data" / "catalogs" / pointer_id
    asset_directory = catalog_root / "assets" / "catalogs" / pointer_id / "players"
    data_directory.mkdir(parents=True)
    asset_directory.mkdir(parents=True)
    (catalog_root / "data" / "current.json").write_text(
        json.dumps({"catalog_id": pointer_id}),
        encoding="utf-8",
    )
    (asset_directory / "player.jpg").write_bytes(b"development image")
    player = player_record()
    player["image_path"] = f"/assets/catalogs/{payload_id}/players/player.jpg"
    (data_directory / "players.json").write_text(
        json.dumps(
            {
                "catalog_id": payload_id,
                "as_of": "2024-06-18",
                "players": [player],
            }
        ),
        encoding="utf-8",
    )
    return catalog_root


def test_registry_loads_current_catalog_and_caches_it(
    tmp_path: Path,
) -> None:
    registry = JsonCatalogRegistry(write_registry(tmp_path))

    current = registry.current()

    assert current.catalog_id == "test-2024-06-18"
    assert registry.get("test-2024-06-18") is current


def test_registry_rejects_unknown_catalog_id(tmp_path: Path) -> None:
    registry = JsonCatalogRegistry(write_registry(tmp_path))

    with pytest.raises(LookupError, match="Unknown catalog"):
        registry.get("missing-2024-06-18")


def test_registry_rejects_path_traversal_catalog_id(
    tmp_path: Path,
) -> None:
    registry = JsonCatalogRegistry(write_registry(tmp_path))

    with pytest.raises(ValueError, match="invalid format"):
        registry.get("../outside")


def test_registry_rejects_directory_payload_id_mismatch(
    tmp_path: Path,
) -> None:
    catalog_root = write_registry(
        tmp_path,
        payload_id="different-2024-06-18",
    )

    with pytest.raises(ValueError, match="must match"):
        JsonCatalogRegistry(catalog_root)


def test_catalog_rejects_duplicate_ids(tmp_path: Path) -> None:
    catalog, assets = write_catalog(
        tmp_path,
        [player_record(), player_record()],
    )

    with pytest.raises(ValueError, match="unique"):
        JsonPlayerCatalog(catalog, assets)


def test_catalog_rejects_mixed_cutoff_dates(tmp_path: Path) -> None:
    player = player_record()
    player["as_of"] = "2023-06-18"
    catalog, assets = write_catalog(tmp_path, [player])

    with pytest.raises(ValueError, match="as_of"):
        JsonPlayerCatalog(catalog, assets)


def test_catalog_rejects_negative_award_counts(tmp_path: Path) -> None:
    player = player_record()
    player["honors"]["mvp"] = -1
    catalog, assets = write_catalog(tmp_path, [player])

    with pytest.raises(ValueError, match="non-negative"):
        JsonPlayerCatalog(catalog, assets)


def test_catalog_rejects_non_numeric_stats(tmp_path: Path) -> None:
    player = player_record()
    player["regular_season"]["ppg"] = "twenty"
    catalog, assets = write_catalog(tmp_path, [player])

    with pytest.raises(ValueError, match="finite or null"):
        JsonPlayerCatalog(catalog, assets)


def test_catalog_requires_explicit_nullable_stats(tmp_path: Path) -> None:
    player = player_record()
    del player["regular_season"]["three_pct"]
    catalog, assets = write_catalog(tmp_path, [player])

    with pytest.raises(ValueError, match="three_pct is required"):
        JsonPlayerCatalog(catalog, assets)


@pytest.mark.parametrize("value", [-0.1, 100.1])
def test_catalog_rejects_percentage_outside_zero_to_one_hundred(
    tmp_path: Path,
    value: float,
) -> None:
    player = player_record()
    player["regular_season"]["three_pct"] = value
    catalog, assets = write_catalog(tmp_path, [player])

    with pytest.raises(ValueError, match="between 0 and 100"):
        JsonPlayerCatalog(catalog, assets)


def test_catalog_accepts_null_historical_awards(tmp_path: Path) -> None:
    player = player_record()
    player["honors"]["dpoy"] = None
    player["honors"]["finals_mvp"] = None
    catalog, assets = write_catalog(tmp_path, [player])

    loaded = JsonPlayerCatalog(catalog, assets).all()[0]

    assert loaded.honors.dpoy is None
    assert loaded.honors.finals_mvp is None


def test_catalog_rejects_more_finals_mvps_than_championships(
    tmp_path: Path,
) -> None:
    player = player_record()
    player["honors"]["championships"] = 1
    player["honors"]["finals_mvp"] = 2
    catalog, assets = write_catalog(tmp_path, [player])

    with pytest.raises(ValueError, match="Finals MVP"):
        JsonPlayerCatalog(catalog, assets)


def test_catalog_rejects_zero_seasons(tmp_path: Path) -> None:
    player = player_record()
    player["seasons"] = 0
    catalog, assets = write_catalog(tmp_path, [player])

    with pytest.raises(ValueError, match="seasons must be positive"):
        JsonPlayerCatalog(catalog, assets)


def test_catalog_rejects_missing_image(tmp_path: Path) -> None:
    player = player_record()
    player["image_path"] = "/assets/catalogs/test-2024-06-18/players/missing.jpg"
    catalog, assets = write_catalog(tmp_path, [player])
    (assets / "missing.jpg").unlink()

    with pytest.raises(ValueError, match="missing image"):
        JsonPlayerCatalog(catalog, assets)


def test_catalog_loads_exact_nested_candidate_pools(tmp_path: Path) -> None:
    players = []
    for index in range(100):
        player = player_record(f"player-{index:03d}")
        player["name"] = f"Player {index:03d}"
        player["image_path"] = (
            f"/assets/catalogs/test-2024-06-18/players/player-{index:03d}.jpg"
        )
        players.append(player)
    ids = [player["id"] for player in players]
    catalog, assets = write_catalog(
        tmp_path,
        players,
        pools={
            "25": ids[:25],
            "50": ids[:50],
            "100": ids,
        },
    )

    loaded = JsonPlayerCatalog(catalog, assets)

    assert tuple(player.id for player in loaded.pool(25)) == tuple(ids[:25])
    assert tuple(player.id for player in loaded.pool(50)) == tuple(ids[:50])
    assert tuple(player.id for player in loaded.pool(100)) == tuple(ids)


def test_catalog_rejects_candidate_pool_with_unknown_player(
    tmp_path: Path,
) -> None:
    player = player_record()
    catalog, assets = write_catalog(
        tmp_path,
        [player],
        pools={
            "25": [player["id"]] * 24 + ["unknown"],
            "50": [player["id"]] * 50,
            "100": [player["id"]] * 100,
        },
    )

    with pytest.raises(ValueError, match="Candidate pool"):
        JsonPlayerCatalog(catalog, assets)
