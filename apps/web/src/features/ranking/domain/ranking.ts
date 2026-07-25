export const RANKING_STATE_SCHEMA_VERSION = 1;

export type VoteOutcome = "better" | "tie" | "worse";
export type ComparisonStage = "cutoff" | "binary";

export interface RankGroup {
  readonly playerIds: readonly string[];
}

export interface Comparison {
  readonly candidateId: string;
  readonly opponentId: string;
}

export interface RankingState {
  readonly remainingPlayerIds: readonly string[];
  readonly groups: readonly RankGroup[];
  readonly candidateId: string | null;
  readonly low: number;
  readonly high: number;
  readonly comparedGroupIndex: number | null;
  readonly comparisonStage: ComparisonStage | null;
  readonly targetSize: number;
  readonly poolSize: number;
  readonly votesCount: number;
  readonly tiesCount: number;
  readonly eliminatedCount: number;
}

export function startRanking(
  playerIds: readonly string[],
  targetSize: number,
): RankingState {
  if (playerIds.length === 0) {
    throw new Error("A ranking needs at least one player.");
  }
  if (new Set(playerIds).size !== playerIds.length) {
    throw new Error("Player IDs must be unique.");
  }
  if (!Number.isInteger(targetSize) || targetSize < 1) {
    throw new Error("Target size must be a positive integer.");
  }

  const state: RankingState = {
    remainingPlayerIds: playerIds.slice(1),
    groups: [{ playerIds: [playerIds[0]] }],
    candidateId: null,
    low: 0,
    high: 0,
    comparedGroupIndex: null,
    comparisonStage: null,
    targetSize: Math.min(targetSize, playerIds.length),
    poolSize: playerIds.length,
    votesCount: 0,
    tiesCount: 0,
    eliminatedCount: 0,
  };
  const result = advanceCandidate(state);
  validateRankingState(result);
  return result;
}

export function applyVote(
  state: RankingState,
  outcome: VoteOutcome,
): RankingState {
  if (isRankingComplete(state)) {
    throw new Error("Cannot vote on a complete ranking.");
  }
  if (
    state.candidateId === null ||
    state.comparedGroupIndex === null
  ) {
    throw new Error("Ranking state has no active comparison.");
  }
  if (!isVoteOutcome(outcome)) {
    throw new Error("Unknown vote outcome.");
  }

  const voted: RankingState = {
    ...state,
    votesCount: state.votesCount + 1,
    tiesCount: state.tiesCount + (outcome === "tie" ? 1 : 0),
  };
  let result: RankingState;
  if (voted.comparisonStage === "cutoff") {
    result = applyCutoffVote(voted, outcome);
  } else if (voted.comparisonStage === "binary") {
    result = applyBinaryVote(voted, outcome);
  } else {
    throw new Error("Ranking state has no comparison stage.");
  }
  validateRankingState(result);
  return result;
}

export function currentComparison(
  state: RankingState,
): Comparison | null {
  if (
    state.candidateId === null ||
    state.comparedGroupIndex === null
  ) {
    return null;
  }
  const opponent = state.groups[state.comparedGroupIndex]?.playerIds[0];
  if (opponent === undefined) {
    throw new Error("Compared rank group has no opponent.");
  }
  return {
    candidateId: state.candidateId,
    opponentId: opponent,
  };
}

export function visibleRankGroups(
  state: RankingState,
): readonly RankGroup[] {
  return trimToCutoff(state.groups, state.targetSize).groups;
}

export function replayRanking(
  playerOrder: readonly string[],
  targetSize: number,
  outcomes: readonly VoteOutcome[],
): RankingState {
  const limit = maximumComparisons(playerOrder.length, targetSize);
  if (outcomes.length > limit) {
    throw new Error("Ranking history exceeds the comparison limit.");
  }
  let state = startRanking(playerOrder, targetSize);
  for (const outcome of outcomes) {
    if (isRankingComplete(state)) {
      throw new Error("Ranking history continues after completion.");
    }
    state = applyVote(state, outcome);
  }
  return state;
}

export function validateRankingState(state: RankingState): void {
  if (!Number.isInteger(state.poolSize) || state.poolSize < 1) {
    throw new Error("Ranking pool size must be positive.");
  }
  if (
    !Number.isInteger(state.targetSize) ||
    state.targetSize < 1 ||
    state.targetSize > state.poolSize
  ) {
    throw new Error("Ranking target size must be within the pool size.");
  }
  const counters = [
    state.votesCount,
    state.tiesCount,
    state.eliminatedCount,
  ];
  if (
    counters.some(
      (counter) => !Number.isInteger(counter) || counter < 0,
    )
  ) {
    throw new Error("Ranking counters must be non-negative integers.");
  }
  if (state.tiesCount > state.votesCount) {
    throw new Error("Tie count cannot exceed vote count.");
  }
  if (
    !Number.isInteger(state.low) ||
    !Number.isInteger(state.high) ||
    state.low < 0 ||
    state.low > state.high ||
    state.high > state.groups.length
  ) {
    throw new Error("Binary-search bounds are invalid.");
  }
  for (const group of state.groups) {
    if (group.playerIds.length === 0) {
      throw new Error("A rank group must contain at least one player.");
    }
  }

  const livePlayerIds = state.groups.flatMap((group) => [
    ...group.playerIds,
  ]);
  livePlayerIds.push(...state.remainingPlayerIds);
  if (state.candidateId !== null) {
    livePlayerIds.push(state.candidateId);
  }
  if (livePlayerIds.some((playerId) => playerId.length === 0)) {
    throw new Error("Player IDs must be non-empty.");
  }
  if (new Set(livePlayerIds).size !== livePlayerIds.length) {
    throw new Error("Live player IDs must be unique.");
  }
  if (
    livePlayerIds.length + state.eliminatedCount !==
    state.poolSize
  ) {
    throw new Error("Ranking state does not match its pool size.");
  }

  if (
    state.comparedGroupIndex !== null &&
    (!Number.isInteger(state.comparedGroupIndex) ||
      state.comparedGroupIndex < 0 ||
      state.comparedGroupIndex >= state.groups.length)
  ) {
    throw new Error("Compared group index is invalid.");
  }
  const isActive = state.candidateId !== null;
  if (
    !isActive &&
    (state.comparedGroupIndex !== null ||
      state.comparisonStage !== null)
  ) {
    throw new Error("Inactive ranking has comparison fields.");
  }
  if (
    isActive &&
    (state.comparedGroupIndex === null ||
      state.comparisonStage === null)
  ) {
    throw new Error("Active ranking is missing comparison fields.");
  }
  if (
    state.comparisonStage !== null &&
    state.comparisonStage !== "cutoff" &&
    state.comparisonStage !== "binary"
  ) {
    throw new Error("Unknown comparison stage.");
  }
  if (
    isRankingComplete(state) &&
    processedPlayerCount(state) !== state.poolSize
  ) {
    throw new Error("Complete ranking has unprocessed players.");
  }
}

export function isRankingComplete(state: RankingState): boolean {
  return (
    state.candidateId === null &&
    state.remainingPlayerIds.length === 0
  );
}

export function processedPlayerCount(state: RankingState): number {
  const active = state.candidateId === null ? 0 : 1;
  return (
    state.poolSize - state.remainingPlayerIds.length - active
  );
}

export function maximumComparisons(
  poolSize: number,
  targetSize: number,
): number {
  if (poolSize <= 1) return 0;
  const boundedTarget = Math.min(
    Math.max(1, targetSize),
    poolSize,
  );
  return (
    (poolSize - 1) *
    (Math.ceil(Math.log2(Math.max(2, boundedTarget))) + 2)
  );
}

function applyCutoffVote(
  state: RankingState,
  outcome: VoteOutcome,
): RankingState {
  if (outcome === "worse") {
    return advanceCandidate({
      ...state,
      candidateId: null,
      comparedGroupIndex: null,
      comparisonStage: null,
      eliminatedCount: state.eliminatedCount + 1,
    });
  }
  if (outcome === "tie") {
    return tieCandidate(state);
  }
  return prepareBinaryComparison({
    ...state,
    low: 0,
    high: state.comparedGroupIndex ?? 0,
    comparedGroupIndex: null,
    comparisonStage: "binary",
  });
}

function applyBinaryVote(
  state: RankingState,
  outcome: VoteOutcome,
): RankingState {
  const comparedIndex = state.comparedGroupIndex;
  if (comparedIndex === null) {
    throw new Error("Binary comparison is missing its group index.");
  }
  if (outcome === "tie") {
    return tieCandidate(state);
  }
  return prepareBinaryComparison({
    ...state,
    low: outcome === "worse" ? comparedIndex + 1 : state.low,
    high: outcome === "better" ? comparedIndex : state.high,
    comparedGroupIndex: null,
  });
}

function prepareBinaryComparison(
  state: RankingState,
): RankingState {
  if (state.candidateId === null) {
    throw new Error("Binary search requires a candidate.");
  }
  if (state.low >= state.high) {
    return insertCandidate(state, state.low);
  }
  return {
    ...state,
    comparedGroupIndex: Math.floor((state.low + state.high) / 2),
    comparisonStage: "binary",
  };
}

function insertCandidate(
  state: RankingState,
  index: number,
): RankingState {
  if (state.candidateId === null) {
    throw new Error("Insertion requires a candidate.");
  }
  const groups = state.groups.map(cloneRankGroup);
  groups.splice(index, 0, { playerIds: [state.candidateId] });
  return finishCandidate(state, groups);
}

function tieCandidate(state: RankingState): RankingState {
  if (
    state.candidateId === null ||
    state.comparedGroupIndex === null
  ) {
    throw new Error("Tie requires an active comparison.");
  }
  const groups = state.groups.map(cloneRankGroup);
  const tiedGroup = groups[state.comparedGroupIndex];
  if (tiedGroup === undefined) {
    throw new Error("Tie group is missing.");
  }
  groups[state.comparedGroupIndex] = {
    playerIds: [...tiedGroup.playerIds, state.candidateId],
  };
  return finishCandidate(state, groups);
}

function finishCandidate(
  state: RankingState,
  groups: readonly RankGroup[],
): RankingState {
  const trimmed = trimToCutoff(groups, state.targetSize);
  return advanceCandidate({
    ...state,
    groups: trimmed.groups,
    candidateId: null,
    low: 0,
    high: 0,
    comparedGroupIndex: null,
    comparisonStage: null,
    eliminatedCount: state.eliminatedCount + trimmed.discarded,
  });
}

function advanceCandidate(state: RankingState): RankingState {
  if (state.candidateId !== null) {
    throw new Error("Cannot advance while a candidate is active.");
  }
  const candidate = state.remainingPlayerIds[0];
  if (candidate === undefined) {
    return {
      ...state,
      low: 0,
      high: 0,
      comparedGroupIndex: null,
      comparisonStage: null,
    };
  }

  const advanced: RankingState = {
    ...state,
    remainingPlayerIds: state.remainingPlayerIds.slice(1),
    candidateId: candidate,
  };
  const cutoffIndex = cutoffGroupIndex(
    advanced.groups,
    advanced.targetSize,
  );
  if (cutoffIndex !== null) {
    return {
      ...advanced,
      low: 0,
      high: cutoffIndex,
      comparedGroupIndex: cutoffIndex,
      comparisonStage: "cutoff",
    };
  }
  return prepareBinaryComparison({
    ...advanced,
    low: 0,
    high: advanced.groups.length,
    comparedGroupIndex: null,
    comparisonStage: "binary",
  });
}

function cutoffGroupIndex(
  groups: readonly RankGroup[],
  targetSize: number,
): number | null {
  let positioned = 0;
  for (let index = 0; index < groups.length; index += 1) {
    positioned += groups[index]?.playerIds.length ?? 0;
    if (positioned >= targetSize) return index;
  }
  return null;
}

function trimToCutoff(
  groups: readonly RankGroup[],
  targetSize: number,
): { groups: readonly RankGroup[]; discarded: number } {
  const cutoffIndex = cutoffGroupIndex(groups, targetSize);
  if (cutoffIndex === null) {
    return {
      groups: groups.map(cloneRankGroup),
      discarded: 0,
    };
  }
  const visible = groups
    .slice(0, cutoffIndex + 1)
    .map(cloneRankGroup);
  const discarded = groups
    .slice(cutoffIndex + 1)
    .reduce((total, group) => total + group.playerIds.length, 0);
  return { groups: visible, discarded };
}

function cloneRankGroup(group: RankGroup): RankGroup {
  return { playerIds: [...group.playerIds] };
}

function isVoteOutcome(value: string): value is VoteOutcome {
  return value === "better" || value === "tie" || value === "worse";
}
