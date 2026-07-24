from __future__ import annotations

from dataclasses import dataclass, replace
from enum import StrEnum
from typing import Any

STATE_SCHEMA_VERSION = 1


class VoteOutcome(StrEnum):
    BETTER = "better"
    TIE = "tie"
    WORSE = "worse"


class ComparisonStage(StrEnum):
    CUTOFF = "cutoff"
    BINARY = "binary"


@dataclass(frozen=True)
class RankGroup:
    player_ids: tuple[str, ...]

    def __post_init__(self) -> None:
        if not self.player_ids:
            raise ValueError("A rank group must contain at least one player.")


@dataclass(frozen=True)
class Comparison:
    candidate_id: str
    opponent_id: str


@dataclass(frozen=True)
class RankingState:
    remaining_player_ids: tuple[str, ...]
    groups: tuple[RankGroup, ...]
    candidate_id: str | None
    low: int
    high: int
    compared_group_index: int | None
    comparison_stage: ComparisonStage | None
    target_size: int
    pool_size: int
    votes_count: int = 0
    ties_count: int = 0
    eliminated_count: int = 0

    @property
    def is_complete(self) -> bool:
        return self.candidate_id is None and not self.remaining_player_ids

    @property
    def processed_count(self) -> int:
        active = 1 if self.candidate_id is not None else 0
        return self.pool_size - len(self.remaining_player_ids) - active

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": STATE_SCHEMA_VERSION,
            "remaining_player_ids": list(self.remaining_player_ids),
            "groups": [list(group.player_ids) for group in self.groups],
            "candidate_id": self.candidate_id,
            "low": self.low,
            "high": self.high,
            "compared_group_index": self.compared_group_index,
            "comparison_stage": (
                self.comparison_stage.value if self.comparison_stage else None
            ),
            "target_size": self.target_size,
            "pool_size": self.pool_size,
            "votes_count": self.votes_count,
            "ties_count": self.ties_count,
            "eliminated_count": self.eliminated_count,
        }

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> RankingState:
        if value.get("schema_version") != STATE_SCHEMA_VERSION:
            raise ValueError("Unsupported ranking state schema version.")
        stage_value = value.get("comparison_stage")
        state = cls(
            remaining_player_ids=tuple(value["remaining_player_ids"]),
            groups=tuple(
                RankGroup(tuple(player_ids)) for player_ids in value["groups"]
            ),
            candidate_id=value.get("candidate_id"),
            low=int(value["low"]),
            high=int(value["high"]),
            compared_group_index=value.get("compared_group_index"),
            comparison_stage=(
                ComparisonStage(stage_value) if stage_value is not None else None
            ),
            target_size=int(value["target_size"]),
            pool_size=int(value["pool_size"]),
            votes_count=int(value["votes_count"]),
            ties_count=int(value["ties_count"]),
            eliminated_count=int(value["eliminated_count"]),
        )
        state.validate()
        return state

    def validate(self) -> None:
        if self.pool_size < 1:
            raise ValueError("Ranking pool size must be positive.")
        if not 1 <= self.target_size <= self.pool_size:
            raise ValueError("Ranking target size must be within the pool size.")
        if (
            min(
                self.votes_count,
                self.ties_count,
                self.eliminated_count,
            )
            < 0
        ):
            raise ValueError("Ranking counters must be non-negative.")
        if self.ties_count > self.votes_count:
            raise ValueError("Tie count cannot exceed vote count.")
        player_ids = [
            player_id for group in self.groups for player_id in group.player_ids
        ]
        player_ids.extend(self.remaining_player_ids)
        if self.candidate_id is not None:
            player_ids.append(self.candidate_id)
        if len(player_ids) != len(set(player_ids)):
            raise ValueError("Live player IDs must be unique.")
        if len(player_ids) + self.eliminated_count != self.pool_size:
            raise ValueError("Ranking state does not match its pool size.")
        if not 0 <= self.low <= self.high <= len(self.groups):
            raise ValueError("Binary-search bounds are invalid.")
        if self.compared_group_index is not None and not (
            0 <= self.compared_group_index < len(self.groups)
        ):
            raise ValueError("Compared group index is invalid.")
        active_fields = (
            self.candidate_id,
            self.compared_group_index,
            self.comparison_stage,
        )
        if self.candidate_id is None and any(
            value is not None for value in active_fields[1:]
        ):
            raise ValueError("Inactive ranking has comparison fields.")
        if self.candidate_id is not None and any(
            value is None for value in active_fields[1:]
        ):
            raise ValueError("Active ranking is missing comparison fields.")
        if self.is_complete and self.processed_count != self.pool_size:
            raise ValueError("Complete ranking has unprocessed players.")


def start_ranking(
    player_ids: tuple[str, ...],
    target_size: int,
) -> RankingState:
    if not player_ids:
        raise ValueError("A ranking needs at least one player.")
    if len(set(player_ids)) != len(player_ids):
        raise ValueError("Player IDs must be unique.")
    if target_size < 1:
        raise ValueError("Target size must be at least one.")

    bounded_target = min(target_size, len(player_ids))
    state = RankingState(
        remaining_player_ids=player_ids[1:],
        groups=(RankGroup((player_ids[0],)),),
        candidate_id=None,
        low=0,
        high=0,
        compared_group_index=None,
        comparison_stage=None,
        target_size=bounded_target,
        pool_size=len(player_ids),
    )
    result = _advance_candidate(state)
    result.validate()
    return result


def current_comparison(state: RankingState) -> Comparison | None:
    if state.candidate_id is None or state.compared_group_index is None:
        return None
    opponent_group = state.groups[state.compared_group_index]
    return Comparison(
        candidate_id=state.candidate_id,
        opponent_id=opponent_group.player_ids[0],
    )


def visible_rank_groups(state: RankingState) -> tuple[RankGroup, ...]:
    return _trim_to_cutoff(state.groups, state.target_size)[0]


def apply_vote(state: RankingState, outcome: VoteOutcome) -> RankingState:
    if state.is_complete:
        raise ValueError("Cannot vote on a complete ranking.")
    if state.candidate_id is None or state.compared_group_index is None:
        raise ValueError("Ranking state has no active comparison.")

    voted = replace(
        state,
        votes_count=state.votes_count + 1,
        ties_count=state.ties_count + (1 if outcome is VoteOutcome.TIE else 0),
    )
    if voted.comparison_stage is ComparisonStage.CUTOFF:
        result = _apply_cutoff_vote(voted, outcome)
        result.validate()
        return result
    if voted.comparison_stage is ComparisonStage.BINARY:
        result = _apply_binary_vote(voted, outcome)
        result.validate()
        return result
    raise ValueError("Ranking state has no comparison stage.")


def _apply_cutoff_vote(
    state: RankingState,
    outcome: VoteOutcome,
) -> RankingState:
    if outcome is VoteOutcome.WORSE:
        eliminated = replace(
            state,
            candidate_id=None,
            compared_group_index=None,
            comparison_stage=None,
            eliminated_count=state.eliminated_count + 1,
        )
        return _advance_candidate(eliminated)
    if outcome is VoteOutcome.TIE:
        return _tie_candidate(state)

    binary_state = replace(
        state,
        low=0,
        high=state.compared_group_index,
        compared_group_index=None,
        comparison_stage=ComparisonStage.BINARY,
    )
    return _prepare_binary_comparison(binary_state)


def _apply_binary_vote(
    state: RankingState,
    outcome: VoteOutcome,
) -> RankingState:
    compared_index = state.compared_group_index
    if compared_index is None:
        raise ValueError("Binary comparison is missing its group index.")
    if outcome is VoteOutcome.TIE:
        return _tie_candidate(state)

    if outcome is VoteOutcome.BETTER:
        narrowed = replace(
            state,
            high=compared_index,
            compared_group_index=None,
        )
    else:
        narrowed = replace(
            state,
            low=compared_index + 1,
            compared_group_index=None,
        )
    return _prepare_binary_comparison(narrowed)


def _prepare_binary_comparison(state: RankingState) -> RankingState:
    if state.candidate_id is None:
        raise ValueError("Binary search requires a candidate.")
    if state.low >= state.high:
        return _insert_candidate(state, state.low)
    compared_index = (state.low + state.high) // 2
    return replace(
        state,
        compared_group_index=compared_index,
        comparison_stage=ComparisonStage.BINARY,
    )


def _insert_candidate(state: RankingState, index: int) -> RankingState:
    if state.candidate_id is None:
        raise ValueError("Insertion requires a candidate.")
    groups = list(state.groups)
    groups.insert(index, RankGroup((state.candidate_id,)))
    return _finish_candidate(state, tuple(groups))


def _tie_candidate(state: RankingState) -> RankingState:
    if state.candidate_id is None or state.compared_group_index is None:
        raise ValueError("Tie requires an active comparison.")
    groups = list(state.groups)
    tied_group = groups[state.compared_group_index]
    groups[state.compared_group_index] = RankGroup(
        (*tied_group.player_ids, state.candidate_id)
    )
    return _finish_candidate(state, tuple(groups))


def _finish_candidate(
    state: RankingState,
    groups: tuple[RankGroup, ...],
) -> RankingState:
    visible_groups, discarded = _trim_to_cutoff(groups, state.target_size)
    finished = replace(
        state,
        groups=visible_groups,
        candidate_id=None,
        low=0,
        high=0,
        compared_group_index=None,
        comparison_stage=None,
        eliminated_count=state.eliminated_count + discarded,
    )
    return _advance_candidate(finished)


def _advance_candidate(state: RankingState) -> RankingState:
    if state.candidate_id is not None:
        raise ValueError("Cannot advance while a candidate is active.")
    if not state.remaining_player_ids:
        return replace(
            state,
            low=0,
            high=0,
            compared_group_index=None,
            comparison_stage=None,
        )

    candidate = state.remaining_player_ids[0]
    advanced = replace(
        state,
        remaining_player_ids=state.remaining_player_ids[1:],
        candidate_id=candidate,
    )
    cutoff_index = _cutoff_group_index(advanced.groups, advanced.target_size)
    if cutoff_index is not None:
        return replace(
            advanced,
            low=0,
            high=cutoff_index,
            compared_group_index=cutoff_index,
            comparison_stage=ComparisonStage.CUTOFF,
        )
    return _prepare_binary_comparison(
        replace(
            advanced,
            low=0,
            high=len(advanced.groups),
            compared_group_index=None,
            comparison_stage=ComparisonStage.BINARY,
        )
    )


def _cutoff_group_index(
    groups: tuple[RankGroup, ...],
    target_size: int,
) -> int | None:
    positioned = 0
    for index, group in enumerate(groups):
        positioned += len(group.player_ids)
        if positioned >= target_size:
            return index
    return None


def _trim_to_cutoff(
    groups: tuple[RankGroup, ...],
    target_size: int,
) -> tuple[tuple[RankGroup, ...], int]:
    cutoff_index = _cutoff_group_index(groups, target_size)
    if cutoff_index is None:
        return groups, 0
    visible = groups[: cutoff_index + 1]
    discarded = sum(len(group.player_ids) for group in groups[cutoff_index + 1 :])
    return visible, discarded
