from __future__ import annotations

import pytest

from blind50.domain.ranking import (
    Comparison,
    RankGroup,
    RankingState,
    VoteOutcome,
    apply_vote,
    current_comparison,
    start_ranking,
    visible_rank_groups,
)


def test_start_seeds_first_player_and_compares_second() -> None:
    state = start_ranking(("a", "b", "c"), target_size=2)

    assert state.groups == (RankGroup(("a",)),)
    assert current_comparison(state) == Comparison(
        candidate_id="b",
        opponent_id="a",
    )
    assert state.processed_count == 1


def test_better_vote_inserts_candidate_before_compared_group() -> None:
    state = start_ranking(("a", "b"), target_size=2)

    result = apply_vote(state, VoteOutcome.BETTER)

    assert result.groups == (RankGroup(("b",)), RankGroup(("a",)))


def test_worse_vote_inserts_candidate_after_compared_group() -> None:
    state = start_ranking(("a", "b"), target_size=2)

    result = apply_vote(state, VoteOutcome.WORSE)

    assert result.groups == (RankGroup(("a",)), RankGroup(("b",)))


def test_tie_vote_adds_candidate_to_existing_group() -> None:
    state = start_ranking(("a", "b"), target_size=2)

    result = apply_vote(state, VoteOutcome.TIE)

    assert result.groups == (RankGroup(("a", "b")),)
    assert result.ties_count == 1


def test_binary_search_needs_multiple_comparisons_for_middle_insertion() -> None:
    state = start_ranking(("a", "b", "c"), target_size=3)
    state = apply_vote(state, VoteOutcome.WORSE)
    assert current_comparison(state) == Comparison("c", "b")

    state = apply_vote(state, VoteOutcome.BETTER)
    assert current_comparison(state) == Comparison("c", "a")

    result = apply_vote(state, VoteOutcome.WORSE)
    assert result.groups == (
        RankGroup(("a",)),
        RankGroup(("c",)),
        RankGroup(("b",)),
    )


def test_tie_group_crossing_cutoff_is_kept_in_full() -> None:
    state = start_ranking(("a", "b", "c"), target_size=2)
    state = apply_vote(state, VoteOutcome.WORSE)

    result = apply_vote(state, VoteOutcome.TIE)

    assert result.groups == (RankGroup(("a",)), RankGroup(("b", "c")))
    assert sum(len(group.player_ids) for group in visible_rank_groups(result)) == 3


def test_candidate_worse_than_established_cutoff_is_eliminated() -> None:
    state = start_ranking(("a", "b", "c"), target_size=2)
    state = apply_vote(state, VoteOutcome.WORSE)

    result = apply_vote(state, VoteOutcome.WORSE)

    assert result.groups == (RankGroup(("a",)), RankGroup(("b",)))
    assert result.eliminated_count == 1


def test_better_candidate_displaces_player_below_cutoff() -> None:
    state = start_ranking(("a", "b", "c"), target_size=2)
    state = apply_vote(state, VoteOutcome.WORSE)
    state = apply_vote(state, VoteOutcome.BETTER)
    state = apply_vote(state, VoteOutcome.WORSE)

    assert state.groups == (RankGroup(("a",)), RankGroup(("c",)))
    assert state.eliminated_count == 1


def test_missing_comparison_after_completion() -> None:
    state = start_ranking(("a", "b"), target_size=2)

    result = apply_vote(state, VoteOutcome.WORSE)

    assert current_comparison(result) is None
    assert result.is_complete is True
    assert result.processed_count == 2


def test_state_round_trips_through_dict_without_changing_comparison() -> None:
    state = start_ranking(("a", "b", "c"), target_size=2)

    restored = RankingState.from_dict(state.to_dict())

    assert restored == state
    assert state.to_dict()["schema_version"] == 1
    assert current_comparison(restored) == current_comparison(state)


def test_state_rejects_unknown_schema_version() -> None:
    value = start_ranking(("a", "b"), target_size=1).to_dict()
    value["schema_version"] = 2

    with pytest.raises(ValueError, match="schema version"):
        RankingState.from_dict(value)


def test_state_rejects_duplicate_live_player_ids() -> None:
    value = start_ranking(("a", "b", "c"), target_size=2).to_dict()
    value["remaining_player_ids"] = ["a", "c"]

    with pytest.raises(ValueError, match="unique"):
        RankingState.from_dict(value)


def test_state_rejects_invalid_compared_group_index() -> None:
    value = start_ranking(("a", "b"), target_size=2).to_dict()
    value["compared_group_index"] = 99

    with pytest.raises(ValueError, match="group index"):
        RankingState.from_dict(value)


def test_state_rejects_negative_counters() -> None:
    value = start_ranking(("a", "b"), target_size=2).to_dict()
    value["votes_count"] = -1

    with pytest.raises(ValueError, match="non-negative"):
        RankingState.from_dict(value)


def test_state_rejects_inconsistent_pool_accounting() -> None:
    value = start_ranking(("a", "b"), target_size=2).to_dict()
    value["pool_size"] = 3

    with pytest.raises(ValueError, match="pool size"):
        RankingState.from_dict(value)


def test_start_rejects_duplicate_players() -> None:
    with pytest.raises(ValueError, match="unique"):
        start_ranking(("a", "a"), target_size=1)


def test_start_rejects_empty_pool() -> None:
    with pytest.raises(ValueError, match="at least one"):
        start_ranking((), target_size=1)


def test_vote_rejects_completed_state() -> None:
    state = start_ranking(("a",), target_size=1)

    with pytest.raises(ValueError, match="complete"):
        apply_vote(state, VoteOutcome.BETTER)
