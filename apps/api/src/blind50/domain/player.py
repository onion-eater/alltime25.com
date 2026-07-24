from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CareerStats:
    games: int
    ppg: float | None
    rpg: float | None
    apg: float | None
    spg: float | None
    bpg: float | None
    fg_pct: float | None
    three_pct: float | None
    ft_pct: float | None


@dataclass(frozen=True)
class Honors:
    mvp: int
    all_nba: int
    dpoy: int | None
    championships: int
    finals_mvp: int | None


@dataclass(frozen=True)
class PlayerResume:
    id: str
    name: str
    era: str
    seasons: int
    regular_season: CareerStats
    playoffs: CareerStats
    honors: Honors
    image_path: str
    as_of: str
    source_note: str
