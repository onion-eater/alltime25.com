from __future__ import annotations

from enum import StrEnum


class RankingPreset(StrEnum):
    TOP_10 = "top_10"
    TOP_25 = "top_25"
    TOP_50 = "top_50"

    @property
    def pool_size(self) -> int:
        return {
            RankingPreset.TOP_10: 25,
            RankingPreset.TOP_25: 50,
            RankingPreset.TOP_50: 100,
        }[self]

    @property
    def target_size(self) -> int:
        return {
            RankingPreset.TOP_10: 10,
            RankingPreset.TOP_25: 25,
            RankingPreset.TOP_50: 50,
        }[self]


class IdentityMode(StrEnum):
    NORMAL = "normal"
    BLIND = "blind"
