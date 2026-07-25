from __future__ import annotations

import math
from itertools import cycle

from hypothesis import given, settings
from hypothesis import strategies as st

from alltime25.domain.ranking import (
    RankingState,
    VoteOutcome,
    apply_vote,
    current_comparison,
    start_ranking,
)


@settings(max_examples=150, deadline=None)
@given(
    scores=st.lists(
        st.integers(min_value=0, max_value=20),
        min_size=1,
        max_size=100,
    ),
    target_seed=st.integers(min_value=1, max_value=100),
)
def test_binary_ranking_matches_a_transitive_preference_model(
    scores: list[int],
    target_seed: int,
) -> None:
    player_ids = tuple(f"player-{index}" for index in range(len(scores)))
    score_by_id = dict(zip(player_ids, scores, strict=True))
    target_size = min(target_seed, len(player_ids))
    state = start_ranking(player_ids, target_size)
    comparisons = 0

    while not state.is_complete:
        comparison = current_comparison(state)
        assert comparison is not None
        candidate_score = score_by_id[comparison.candidate_id]
        opponent_score = score_by_id[comparison.opponent_id]
        outcome = (
            VoteOutcome.BETTER
            if candidate_score > opponent_score
            else VoteOutcome.WORSE
            if candidate_score < opponent_score
            else VoteOutcome.TIE
        )
        state = apply_vote(state, outcome)
        comparisons += 1
        state.validate()

    flattened = [player_id for group in state.groups for player_id in group.player_ids]
    cutoff_score = sorted(scores, reverse=True)[target_size - 1]
    assert set(flattened) == {
        player_id for player_id, score in score_by_id.items() if score >= cutoff_score
    }
    assert [score_by_id[player_id] for player_id in flattened] == sorted(
        (score_by_id[player_id] for player_id in flattened),
        reverse=True,
    )
    max_comparisons = max(
        0,
        (len(player_ids) - 1) * (math.ceil(math.log2(max(2, target_size))) + 2),
    )
    assert comparisons <= max_comparisons


@settings(max_examples=100, deadline=None)
@given(
    pool_size=st.integers(min_value=1, max_value=100),
    target_seed=st.integers(min_value=1, max_value=100),
    outcomes=st.lists(
        st.sampled_from(tuple(VoteOutcome)),
        min_size=1,
        max_size=30,
    ),
)
def test_inconsistent_votes_still_terminate_with_valid_state(
    pool_size: int,
    target_seed: int,
    outcomes: list[VoteOutcome],
) -> None:
    player_ids = tuple(f"player-{index}" for index in range(pool_size))
    target_size = min(target_seed, pool_size)
    state = start_ranking(player_ids, target_size)
    outcome_stream = cycle(outcomes)
    comparison_limit = max(
        0,
        (pool_size - 1) * (math.ceil(math.log2(max(2, target_size))) + 2),
    )

    for _ in range(comparison_limit + 1):
        if state.is_complete:
            break
        state = apply_vote(state, next(outcome_stream))
        state.validate()

    assert state.is_complete
    assert state.processed_count == pool_size


def test_all_one_hundred_players_can_share_the_cutoff_rank() -> None:
    player_ids = tuple(f"player-{index}" for index in range(100))
    state: RankingState = start_ranking(player_ids, target_size=50)

    while not state.is_complete:
        state = apply_vote(state, VoteOutcome.TIE)

    assert len(state.groups) == 1
    assert len(state.groups[0].player_ids) == 100
    assert state.votes_count == 99
    assert state.ties_count == 99
