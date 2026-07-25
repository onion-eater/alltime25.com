from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections.abc import Callable
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
API_SOURCE = REPOSITORY_ROOT / "apps" / "api" / "src"
sys.path.insert(0, str(API_SOURCE))

from alltime25.domain.ranking import (  # noqa: E402
    RankingState,
    VoteOutcome,
    apply_vote,
    current_comparison,
    start_ranking,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export deterministic Python ranking parity fixtures.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=(
            REPOSITORY_ROOT
            / "apps"
            / "web"
            / "src"
            / "features"
            / "ranking"
            / "domain"
            / "rankingParity.json"
        ),
    )
    return parser.parse_args()


def state_hash(state: RankingState) -> str:
    payload = json.dumps(
        state.to_dict(),
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def trace_case(
    name: str,
    player_ids: tuple[str, ...],
    target_size: int,
    outcomes: tuple[VoteOutcome, ...],
) -> dict[str, object]:
    state = start_ranking(player_ids, target_size)
    states = [state.to_dict()]
    comparisons = []
    for outcome in outcomes:
        comparison = current_comparison(state)
        if comparison is None:
            raise ValueError(f"{name} has an outcome after completion.")
        comparisons.append(
            {
                "candidate_id": comparison.candidate_id,
                "opponent_id": comparison.opponent_id,
                "outcome": outcome.value,
            }
        )
        state = apply_vote(state, outcome)
        states.append(state.to_dict())
    return {
        "name": name,
        "player_ids": list(player_ids),
        "target_size": target_size,
        "comparisons": comparisons,
        "states": states,
    }


def completed_case(
    name: str,
    player_ids: tuple[str, ...],
    target_size: int,
    choose_outcome: Callable[[RankingState], VoteOutcome],
) -> dict[str, object]:
    state = start_ranking(player_ids, target_size)
    outcomes = []
    while not state.is_complete:
        outcome = choose_outcome(state)
        outcomes.append(outcome.value)
        state = apply_vote(state, outcome)
    return {
        "name": name,
        "player_ids": list(player_ids),
        "target_size": target_size,
        "outcomes": outcomes,
        "final_state": state.to_dict(),
    }


def transitive_outcome(
    state: RankingState,
    scores: dict[str, int],
) -> VoteOutcome:
    comparison = current_comparison(state)
    if comparison is None:
        raise ValueError("A completed ranking has no comparison.")
    candidate = scores[comparison.candidate_id]
    opponent = scores[comparison.opponent_id]
    if candidate > opponent:
        return VoteOutcome.BETTER
    if candidate < opponent:
        return VoteOutcome.WORSE
    return VoteOutcome.TIE


def broad_matrix() -> list[dict[str, object]]:
    matrix = []
    for pool_size in range(1, 101):
        player_ids = tuple(f"player-{index:03d}" for index in range(pool_size))
        for target_size in range(1, pool_size + 1):
            scores = {
                player_id: ((index * 37 + pool_size * 11 + target_size * 7) % 23)
                for index, player_id in enumerate(player_ids)
            }
            state = start_ranking(player_ids, target_size)
            comparisons = 0
            while not state.is_complete:
                state = apply_vote(state, transitive_outcome(state, scores))
                comparisons += 1
            matrix.append(
                {
                    "pool_size": pool_size,
                    "target_size": target_size,
                    "comparison_count": comparisons,
                    "final_state_sha256": state_hash(state),
                }
            )
    return matrix


def main() -> int:
    args = parse_args()
    small = ("a", "b", "c")
    one_hundred = tuple(f"player-{index:03d}" for index in range(100))
    trace_cases = [
        trace_case("single-player", ("a",), 1, ()),
        trace_case("better-insertion", ("a", "b"), 2, (VoteOutcome.BETTER,)),
        trace_case("worse-insertion", ("a", "b"), 2, (VoteOutcome.WORSE,)),
        trace_case("tie-insertion", ("a", "b"), 2, (VoteOutcome.TIE,)),
        trace_case(
            "middle-insertion",
            small,
            3,
            (VoteOutcome.WORSE, VoteOutcome.BETTER, VoteOutcome.WORSE),
        ),
        trace_case(
            "cutoff-tie",
            small,
            2,
            (VoteOutcome.WORSE, VoteOutcome.TIE),
        ),
        trace_case(
            "cutoff-elimination",
            small,
            2,
            (VoteOutcome.WORSE, VoteOutcome.WORSE),
        ),
        trace_case(
            "cutoff-displacement",
            small,
            2,
            (VoteOutcome.WORSE, VoteOutcome.BETTER, VoteOutcome.WORSE),
        ),
    ]
    completed_cases = [
        completed_case(
            "all-one-hundred-tied",
            one_hundred,
            50,
            lambda _state: VoteOutcome.TIE,
        ),
        completed_case(
            "inconsistent-cycle",
            tuple(f"player-{index:03d}" for index in range(7)),
            4,
            lambda state: VoteOutcome(
                ("better", "worse", "tie")[state.votes_count % 3]
            ),
        ),
    ]
    payload = {
        "fixture_schema_version": 1,
        "state_schema_version": 1,
        "trace_cases": trace_cases,
        "completed_cases": completed_cases,
        "broad_matrix": broad_matrix(),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
