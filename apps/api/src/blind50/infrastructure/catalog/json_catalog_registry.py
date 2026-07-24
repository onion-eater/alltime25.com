from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from blind50.infrastructure.catalog.json_player_catalog import JsonPlayerCatalog

CATALOG_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{0,127}$")


class JsonCatalogRegistry:
    def __init__(
        self,
        catalog_root: Path,
        current_catalog_id: str | None = None,
    ) -> None:
        self.catalog_root = catalog_root.resolve()
        self._current_catalog_id = current_catalog_id or self._load_current_catalog_id()
        self._validate_catalog_id(self._current_catalog_id)
        self._catalogs: dict[str, JsonPlayerCatalog] = {}
        self.current()

    def current(self) -> JsonPlayerCatalog:
        return self.get(self._current_catalog_id)

    def get(self, catalog_id: str) -> JsonPlayerCatalog:
        self._validate_catalog_id(catalog_id)
        existing = self._catalogs.get(catalog_id)
        if existing is not None:
            return existing

        catalog_path = (
            self.catalog_root / "data" / "catalogs" / catalog_id / "players.json"
        )
        asset_directory = (
            self.catalog_root / "assets" / "catalogs" / catalog_id / "players"
        )
        if not catalog_path.is_file() or not asset_directory.is_dir():
            raise LookupError(f"Unknown catalog ID: {catalog_id}")
        catalog = JsonPlayerCatalog(catalog_path, asset_directory)
        if catalog.catalog_id != catalog_id:
            raise ValueError("Catalog directory and payload IDs must match.")
        self._catalogs[catalog_id] = catalog
        return catalog

    def _load_current_catalog_id(self) -> str:
        pointer_path = self.catalog_root / "data" / "current.json"
        try:
            payload: Any = json.loads(pointer_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise ValueError("Current catalog pointer is unavailable.") from error
        if not isinstance(payload, dict):
            raise ValueError("Current catalog pointer must be an object.")
        catalog_id = payload.get("catalog_id")
        if not isinstance(catalog_id, str):
            raise ValueError("Current catalog pointer needs a catalog_id.")
        self._validate_catalog_id(catalog_id)
        return catalog_id

    @staticmethod
    def _validate_catalog_id(catalog_id: str) -> None:
        if CATALOG_ID_PATTERN.fullmatch(catalog_id) is None:
            raise ValueError("Catalog ID has an invalid format.")
