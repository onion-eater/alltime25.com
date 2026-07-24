from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from blind50.application.ports.player_catalog import PlayerCatalog
from blind50.application.ports.session_repository import StoredRankingSession
from blind50.domain.player import CareerStats, Honors, PlayerResume
from blind50.domain.ranking import VoteOutcome, current_comparison


class CareerStatsResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    games: int
    ppg: float | None
    rpg: float | None
    apg: float | None
    spg: float | None
    bpg: float | None
    fg_pct: float | None
    three_pct: float | None
    ft_pct: float | None

    @classmethod
    def from_domain(cls, value: CareerStats) -> CareerStatsResponse:
        return cls(
            games=value.games,
            ppg=value.ppg,
            rpg=value.rpg,
            apg=value.apg,
            spg=value.spg,
            bpg=value.bpg,
            fg_pct=value.fg_pct,
            three_pct=value.three_pct,
            ft_pct=value.ft_pct,
        )


class HonorsResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    mvp: int
    all_nba: int
    dpoy: int | None
    championships: int
    finals_mvp: int | None

    @classmethod
    def from_domain(cls, value: Honors) -> HonorsResponse:
        return cls(
            mvp=value.mvp,
            all_nba=value.all_nba,
            dpoy=value.dpoy,
            championships=value.championships,
            finals_mvp=value.finals_mvp,
        )


class AnonymousPlayerResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    label: str
    code: str
    era: str
    seasons: int
    regular_season: CareerStatsResponse
    playoffs: CareerStatsResponse
    honors: HonorsResponse


class ComparisonResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    player_a: AnonymousPlayerResponse
    player_b: AnonymousPlayerResponse


class ProgressResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    processed: int
    total: int
    votes: int
    ties: int
    eliminated: int


class RevealedPlayerResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    era: str
    image_url: str


class RankingGroupResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    rank: int
    players: tuple[RevealedPlayerResponse, ...]


class SessionResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    status: Literal["active", "complete"]
    target_size: int
    pool_size: int
    version: int
    can_undo: bool
    catalog_id: str
    progress: ProgressResponse
    comparison: ComparisonResponse | None
    ranking: tuple[RankingGroupResponse, ...] | None


class CreateSessionRequest(BaseModel):
    model_config = ConfigDict(frozen=True)

    operation_id: UUID


class VoteRequest(BaseModel):
    model_config = ConfigDict(frozen=True)

    operation_id: UUID
    expected_version: int = Field(ge=0)
    outcome: VoteOutcome


class UndoRequest(BaseModel):
    model_config = ConfigDict(frozen=True)

    operation_id: UUID
    expected_version: int = Field(ge=0)


class ApiErrorResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    code: str
    message: str
    current_version: int | None


def build_session_response(
    session: StoredRankingSession,
    catalog: PlayerCatalog,
) -> SessionResponse:
    state = session.state
    code_by_player_id = {
        player_id: f"#{index:03d}"
        for index, player_id in enumerate(session.player_order, start=1)
    }
    comparison = current_comparison(state)
    comparison_response = None
    if comparison is not None:
        comparison_response = ComparisonResponse(
            player_a=_anonymous_player(
                catalog.get(comparison.candidate_id),
                label="Player A",
                code=code_by_player_id[comparison.candidate_id],
            ),
            player_b=_anonymous_player(
                catalog.get(comparison.opponent_id),
                label="Player B",
                code=code_by_player_id[comparison.opponent_id],
            ),
        )

    ranking = None
    if state.is_complete:
        next_rank = 1
        groups: list[RankingGroupResponse] = []
        for group in state.groups:
            groups.append(
                RankingGroupResponse(
                    rank=next_rank,
                    players=tuple(
                        _revealed_player(catalog.get(player_id))
                        for player_id in group.player_ids
                    ),
                )
            )
            next_rank += len(group.player_ids)
        ranking = tuple(groups)

    return SessionResponse(
        id=session.id,
        status="complete" if state.is_complete else "active",
        target_size=state.target_size,
        pool_size=state.pool_size,
        version=session.version,
        can_undo=session.can_undo,
        catalog_id=session.catalog_id,
        progress=ProgressResponse(
            processed=state.processed_count,
            total=state.pool_size,
            votes=state.votes_count,
            ties=state.ties_count,
            eliminated=state.eliminated_count,
        ),
        comparison=comparison_response,
        ranking=ranking,
    )


def _anonymous_player(
    player: PlayerResume,
    *,
    label: str,
    code: str,
) -> AnonymousPlayerResponse:
    return AnonymousPlayerResponse(
        label=label,
        code=code,
        era=player.era,
        seasons=player.seasons,
        regular_season=CareerStatsResponse.from_domain(player.regular_season),
        playoffs=CareerStatsResponse.from_domain(player.playoffs),
        honors=HonorsResponse.from_domain(player.honors),
    )


def _revealed_player(player: PlayerResume) -> RevealedPlayerResponse:
    return RevealedPlayerResponse(
        name=player.name,
        era=player.era,
        image_url=player.image_path,
    )
