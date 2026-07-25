/// <reference types="node" />

import { createHash } from "node:crypto";

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import parity from "@/features/ranking/domain/rankingParity.json";
import {
  applyVote,
  currentComparison,
  isRankingComplete,
  maximumComparisons,
  processedPlayerCount,
  replayRanking,
  startRanking,
  validateRankingState,
  visibleRankGroups,
  type RankingState,
  type VoteOutcome,
} from "@/features/ranking/domain/ranking";

interface SerializedState {
  schema_version: number;
  remaining_player_ids: readonly string[];
  groups: readonly (readonly string[])[];
  candidate_id: string | null;
  low: number;
  high: number;
  compared_group_index: number | null;
  comparison_stage: string | null;
  target_size: number;
  pool_size: number;
  votes_count: number;
  ties_count: number;
  eliminated_count: number;
}

describe("ranking domain", () => {
  it("matches every Python trace state exactly", () => {
    for (const testCase of parity.trace_cases) {
      let state = startRanking(
        testCase.player_ids,
        testCase.target_size,
      );
      expect(serializeState(state)).toEqual(testCase.states[0]);
      for (const [index, expected] of testCase.comparisons.entries()) {
        expect(currentComparison(state)).toEqual({
          candidateId: expected.candidate_id,
          opponentId: expected.opponent_id,
        });
        state = applyVote(state, expected.outcome as VoteOutcome);
        expect(serializeState(state)).toEqual(
          testCase.states[index + 1],
        );
      }
    }
  });

  it("matches the completed Python edge cases", () => {
    for (const testCase of parity.completed_cases) {
      const state = replayRanking(
        testCase.player_ids,
        testCase.target_size,
        testCase.outcomes as VoteOutcome[],
      );
      expect(serializeState(state)).toEqual(testCase.final_state);
    }
  });

  it(
    "matches Python for every pool and target from one to one hundred",
    () => {
      for (const expected of parity.broad_matrix) {
      const playerIds = Array.from(
        { length: expected.pool_size },
        (_, index) => `player-${String(index).padStart(3, "0")}`,
      );
      const scores = new Map(
        playerIds.map((playerId, index) => [
          playerId,
          (index * 37 +
            expected.pool_size * 11 +
            expected.target_size * 7) %
            23,
        ]),
      );
      let state = startRanking(playerIds, expected.target_size);
      let comparisons = 0;
      while (!isRankingComplete(state)) {
        const comparison = currentComparison(state);
        if (comparison === null) {
          throw new Error("Active ranking has no comparison.");
        }
        const candidate = scores.get(comparison.candidateId);
        const opponent = scores.get(comparison.opponentId);
        if (candidate === undefined || opponent === undefined) {
          throw new Error("Missing synthetic score.");
        }
        state = applyVote(
          state,
          candidate > opponent
            ? "better"
            : candidate < opponent
              ? "worse"
              : "tie",
        );
        comparisons += 1;
      }
      expect(comparisons).toBe(expected.comparison_count);
        expect(hashState(state)).toBe(expected.final_state_sha256);
      }
    },
    30_000,
  );

  it("matches a transitive preference model across random pools", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 20 }), {
          minLength: 1,
          maxLength: 100,
        }),
        fc.integer({ min: 1, max: 100 }),
        (scores, targetSeed) => {
          const playerIds = scores.map(
            (_, index) => `player-${index}`,
          );
          const scoreById = new Map(
            playerIds.map((playerId, index) => [
              playerId,
              scores[index] ?? 0,
            ]),
          );
          const targetSize = Math.min(targetSeed, playerIds.length);
          let state = startRanking(playerIds, targetSize);
          let comparisons = 0;
          while (!isRankingComplete(state)) {
            const comparison = currentComparison(state);
            if (comparison === null) return false;
            const candidate =
              scoreById.get(comparison.candidateId) ?? 0;
            const opponent =
              scoreById.get(comparison.opponentId) ?? 0;
            state = applyVote(
              state,
              candidate > opponent
                ? "better"
                : candidate < opponent
                  ? "worse"
                  : "tie",
            );
            comparisons += 1;
            validateRankingState(state);
          }

          const flattened = state.groups.flatMap((group) => [
            ...group.playerIds,
          ]);
          const sortedScores = [...scores].sort((a, b) => b - a);
          const cutoffScore = sortedScores[targetSize - 1] ?? 0;
          const expectedPlayers = new Set(
            playerIds.filter(
              (playerId) =>
                (scoreById.get(playerId) ?? 0) >= cutoffScore,
            ),
          );
          expect(new Set(flattened)).toEqual(expectedPlayers);
          expect(
            flattened.map((playerId) => scoreById.get(playerId)),
          ).toEqual(
            flattened
              .map((playerId) => scoreById.get(playerId))
              .sort((a, b) => (b ?? 0) - (a ?? 0)),
          );
          expect(comparisons).toBeLessThanOrEqual(
            maximumComparisons(playerIds.length, targetSize),
          );
        },
      ),
      { numRuns: 500 },
    );
  });

  it("terminates safely for inconsistent vote cycles", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        fc.array(fc.constantFrom<VoteOutcome>("better", "tie", "worse"), {
          minLength: 1,
          maxLength: 30,
        }),
        (poolSize, targetSeed, outcomes) => {
          const playerIds = Array.from(
            { length: poolSize },
            (_, index) => `player-${index}`,
          );
          const targetSize = Math.min(targetSeed, poolSize);
          let state = startRanking(playerIds, targetSize);
          const limit = maximumComparisons(poolSize, targetSize);
          for (
            let comparison = 0;
            comparison <= limit && !isRankingComplete(state);
            comparison += 1
          ) {
            state = applyVote(
              state,
              outcomes[comparison % outcomes.length] ?? "tie",
            );
            validateRankingState(state);
          }
          expect(isRankingComplete(state)).toBe(true);
          expect(processedPlayerCount(state)).toBe(poolSize);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("exhaustively validates every reachable state through seven players", () => {
    const outcomes: readonly VoteOutcome[] = [
      "better",
      "tie",
      "worse",
    ];
    for (let poolSize = 1; poolSize <= 7; poolSize += 1) {
      const players = Array.from(
        { length: poolSize },
        (_, index) => `player-${index}`,
      );
      for (let target = 1; target <= poolSize; target += 1) {
        const pending = [startRanking(players, target)];
        const seen = new Set<string>();
        while (pending.length > 0) {
          const state = pending.pop();
          if (state === undefined) break;
          const key = stableJson(serializeState(state));
          if (seen.has(key)) continue;
          seen.add(key);
          validateRankingState(state);
          if (isRankingComplete(state)) continue;
          for (const outcome of outcomes) {
            pending.push(applyVote(state, outcome));
          }
        }
      }
    }
  });

  it("keeps all one hundred players in a cutoff tie", () => {
    const playerIds = Array.from(
      { length: 100 },
      (_, index) => `player-${index}`,
    );
    let state = startRanking(playerIds, 50);
    while (!isRankingComplete(state)) {
      state = applyVote(state, "tie");
    }
    expect(visibleRankGroups(state)).toHaveLength(1);
    expect(visibleRankGroups(state)[0]?.playerIds).toHaveLength(100);
    expect(state.votesCount).toBe(99);
    expect(state.tiesCount).toBe(99);
  });

  it("does not mutate earlier states", () => {
    const state = startRanking(["a", "b", "c"], 2);
    const snapshot = structuredClone(state);
    applyVote(state, "tie");
    expect(state).toEqual(snapshot);
  });

  it("rejects corrupt states and histories", () => {
    const state = startRanking(["a", "b"], 1);
    expect(() =>
      validateRankingState({
        ...state,
        remainingPlayerIds: ["a"],
      }),
    ).toThrow(/unique/i);
    expect(() =>
      validateRankingState({
        ...state,
        comparedGroupIndex: 99,
      }),
    ).toThrow(/group index/i);
    expect(() =>
      validateRankingState({
        ...state,
        votesCount: -1,
      }),
    ).toThrow(/non-negative/i);
    expect(() => startRanking([], 1)).toThrow(/at least one/i);
    expect(() => startRanking(["a", "a"], 1)).toThrow(/unique/i);
    expect(() =>
      replayRanking(["a", "b"], 2, ["better", "worse"]),
    ).toThrow(/after completion/i);
  });
});

function serializeState(state: RankingState): SerializedState {
  return {
    schema_version: 1,
    remaining_player_ids: state.remainingPlayerIds,
    groups: state.groups.map((group) => group.playerIds),
    candidate_id: state.candidateId,
    low: state.low,
    high: state.high,
    compared_group_index: state.comparedGroupIndex,
    comparison_stage: state.comparisonStage,
    target_size: state.targetSize,
    pool_size: state.poolSize,
    votes_count: state.votesCount,
    ties_count: state.tiesCount,
    eliminated_count: state.eliminatedCount,
  };
}

function hashState(state: RankingState): string {
  return createHash("sha256")
    .update(stableJson(serializeState(state)))
    .digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableJson(record[key])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
