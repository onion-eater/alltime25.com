from __future__ import annotations

from typing import Protocol

from blind50.domain.player import PlayerResume


class PlayerCatalog(Protocol):
    catalog_id: str

    def all(self) -> tuple[PlayerResume, ...]: ...

    def get(self, player_id: str) -> PlayerResume: ...


class PlayerCatalogRegistry(Protocol):
    def current(self) -> PlayerCatalog: ...

    def get(self, catalog_id: str) -> PlayerCatalog: ...
