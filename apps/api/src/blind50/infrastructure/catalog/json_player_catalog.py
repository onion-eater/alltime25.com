from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

from blind50.domain.player import CareerStats, Honors, PlayerResume


class JsonPlayerCatalog:
    def __init__(self, catalog_path: Path, asset_directory: Path) -> None:
        self.catalog_path = catalog_path
        self.asset_directory = asset_directory
        self.catalog_id, self._players = self._load()
        self._by_id = {player.id: player for player in self._players}

    def all(self) -> tuple[PlayerResume, ...]:
        return self._players

    def get(self, player_id: str) -> PlayerResume:
        try:
            return self._by_id[player_id]
        except KeyError as error:
            raise LookupError(player_id) from error

    def assets_ready(self) -> bool:
        return all(
            (self.asset_directory / Path(player.image_path).name).is_file()
            for player in self._players
        )

    def _load(self) -> tuple[str, tuple[PlayerResume, ...]]:
        payload = json.loads(self.catalog_path.read_text(encoding="utf-8"))
        catalog_id = self._required_string(payload, "catalog_id")
        records = payload.get("players")
        if not isinstance(records, list) or not records:
            raise ValueError("Player catalog must contain a non-empty players list.")
        catalog_as_of = payload.get("as_of")
        if not isinstance(catalog_as_of, str) or not catalog_as_of:
            raise ValueError("Player catalog must declare an as_of date.")

        players = tuple(
            self._parse_player(record, catalog_id=catalog_id) for record in records
        )
        ids = [player.id for player in players]
        if len(set(ids)) != len(ids):
            raise ValueError("Player catalog IDs must be unique.")
        if any(player.as_of != catalog_as_of for player in players):
            raise ValueError("Every player must use the catalog as_of date.")
        return catalog_id, players

    def _parse_player(
        self,
        record: dict[str, Any],
        *,
        catalog_id: str,
    ) -> PlayerResume:
        player = PlayerResume(
            id=self._required_string(record, "id"),
            name=self._required_string(record, "name"),
            era=self._required_string(record, "era"),
            seasons=self._positive_int(record, "seasons"),
            regular_season=self._parse_stats(
                record["regular_season"],
                require_games=True,
            ),
            playoffs=self._parse_stats(
                record["playoffs"],
                require_games=False,
            ),
            honors=self._parse_honors(record["honors"]),
            image_path=self._required_string(record, "image_path"),
            as_of=self._required_string(record, "as_of"),
            source_note=self._required_string(record, "source_note"),
        )
        image_name = Path(player.image_path).name
        expected_path = f"/assets/catalogs/{catalog_id}/players/{image_name}"
        if player.image_path != expected_path:
            raise ValueError(f"{player.id} has a non-canonical image path.")
        if not (self.asset_directory / image_name).is_file():
            raise ValueError(f"{player.id} is missing image asset {image_name}.")
        return player

    def _parse_stats(
        self,
        record: dict[str, Any],
        *,
        require_games: bool,
    ) -> CareerStats:
        return CareerStats(
            games=(
                self._positive_int(record, "games")
                if require_games
                else self._non_negative_int(record, "games")
            ),
            ppg=self._optional_non_negative_number(record, "ppg"),
            rpg=self._optional_non_negative_number(record, "rpg"),
            apg=self._optional_non_negative_number(record, "apg"),
            spg=self._optional_non_negative_number(record, "spg"),
            bpg=self._optional_non_negative_number(record, "bpg"),
            fg_pct=self._optional_percentage(record, "fg_pct"),
            three_pct=self._optional_percentage(record, "three_pct"),
            ft_pct=self._optional_percentage(record, "ft_pct"),
        )

    def _parse_honors(self, record: dict[str, Any]) -> Honors:
        honors = Honors(
            mvp=self._non_negative_int(record, "mvp"),
            all_nba=self._non_negative_int(record, "all_nba"),
            dpoy=self._optional_non_negative_int(record, "dpoy"),
            championships=self._non_negative_int(record, "championships"),
            finals_mvp=self._optional_non_negative_int(record, "finals_mvp"),
        )
        if honors.finals_mvp is not None and honors.finals_mvp > honors.championships:
            raise ValueError("Finals MVP count cannot exceed championships.")
        return honors

    @staticmethod
    def _required_string(record: dict[str, Any], key: str) -> str:
        value = record.get(key)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{key} must be a non-empty string.")
        return value

    @staticmethod
    def _non_negative_int(record: dict[str, Any], key: str) -> int:
        value = record.get(key)
        if not isinstance(value, int) or isinstance(value, bool) or value < 0:
            raise ValueError(f"{key} must be a non-negative integer.")
        return value

    @staticmethod
    def _positive_int(record: dict[str, Any], key: str) -> int:
        value = record.get(key)
        if not isinstance(value, int) or isinstance(value, bool) or value < 1:
            raise ValueError(f"{key} must be positive.")
        return value

    @staticmethod
    def _optional_non_negative_int(
        record: dict[str, Any],
        key: str,
    ) -> int | None:
        if key not in record:
            raise ValueError(f"{key} is required.")
        value = record[key]
        if value is None:
            return None
        if not isinstance(value, int) or isinstance(value, bool) or value < 0:
            raise ValueError(f"{key} must be a non-negative integer or null.")
        return value

    @staticmethod
    def _optional_number(
        record: dict[str, Any],
        key: str,
    ) -> float | None:
        if key not in record:
            raise ValueError(f"{key} is required.")
        value = record[key]
        if value is None:
            return None
        if (
            not isinstance(value, int | float)
            or isinstance(value, bool)
            or not math.isfinite(value)
        ):
            raise ValueError(f"{key} must be finite or null.")
        return float(value)

    @classmethod
    def _optional_non_negative_number(
        cls,
        record: dict[str, Any],
        key: str,
    ) -> float | None:
        value = cls._optional_number(record, key)
        if value is not None and value < 0:
            raise ValueError(f"{key} must be non-negative or null.")
        return value

    @classmethod
    def _optional_percentage(
        cls,
        record: dict[str, Any],
        key: str,
    ) -> float | None:
        value = cls._optional_number(record, key)
        if value is not None and not 0 <= value <= 100:
            raise ValueError(f"{key} must be between 0 and 100 or null.")
        return value
