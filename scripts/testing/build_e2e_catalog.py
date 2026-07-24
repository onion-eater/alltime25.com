from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

CATALOG_ID = "e2e-100"
AS_OF = "2026-06-30"
PORTRAIT = """<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
<rect width="600" height="800" fill="#eceae4"/>
<circle cx="300" cy="270" r="118" fill="#8a8a84"/>
<path d="M104 800c8-190 82-304 196-304s188 114 196 304H104Z" fill="#8a8a84"/>
</svg>
"""


def build_catalog(output: Path) -> None:
    resolved = output.resolve()
    if resolved.exists():
        shutil.rmtree(resolved)
    data_directory = resolved / "data" / "catalogs" / CATALOG_ID
    asset_directory = resolved / "assets" / "catalogs" / CATALOG_ID / "players"
    data_directory.mkdir(parents=True)
    asset_directory.mkdir(parents=True)

    stats = {
        "games": 1000,
        "ppg": 20.0,
        "rpg": 6.0,
        "apg": 5.0,
        "spg": 1.2,
        "bpg": 0.8,
        "fg_pct": 48.0,
        "three_pct": 35.0,
        "ft_pct": 80.0,
    }
    players = []
    for number in range(1, 101):
        player_id = f"e2e-player-{number:03d}"
        image_name = f"{player_id}.svg"
        (asset_directory / image_name).write_text(PORTRAIT, encoding="utf-8")
        players.append(
            {
                "id": player_id,
                "name": (
                    "Željko Longname-Williams"
                    if number == 100
                    else f"Test Player {number:03d}"
                ),
                "era": f"{1940 + ((number - 1) % 9) * 10}s",
                "seasons": 15,
                "regular_season": stats,
                "playoffs": {**stats, "games": 120},
                "honors": {
                    "mvp": 0,
                    "all_nba": 0,
                    "dpoy": 0,
                    "championships": 0,
                    "finals_mvp": 0,
                },
                "image_path": (f"/assets/catalogs/{CATALOG_ID}/players/{image_name}"),
                "as_of": AS_OF,
                "source_note": "Synthetic end-to-end test fixture.",
            }
        )

    (data_directory / "players.json").write_text(
        json.dumps(
            {
                "catalog_id": CATALOG_ID,
                "as_of": AS_OF,
                "players": players,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    player_ids = [player["id"] for player in players]
    (data_directory / "pools.json").write_text(
        json.dumps(
            {
                "catalog_id": CATALOG_ID,
                "pools": {
                    "25": player_ids[:25],
                    "50": player_ids[:50],
                    "100": player_ids,
                },
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    (resolved / "data" / "current.json").write_text(
        json.dumps({"catalog_id": CATALOG_ID}, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    build_catalog(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
