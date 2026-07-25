import type { PlayerCatalog } from "@/features/ranking/catalog/catalogRepository";
import {
  PRESET_SIZES,
  type RankingSelection,
} from "@/features/ranking/domain/player";
import {
  isRankingComplete,
  replayRanking,
  type RankingState,
  type VoteOutcome,
} from "@/features/ranking/domain/ranking";
import {
  RANKING_ALGORITHM_VERSION,
  SESSION_SCHEMA_VERSION,
  validatePersistedSession,
  type PersistedRankingSessionV1,
} from "@/features/ranking/persistence/persistedSession";

export class RankingCompleteError extends Error {
  constructor() {
    super("This ranking is already complete.");
    this.name = "RankingCompleteError";
  }
}

export class NothingToUndoError extends Error {
  constructor() {
    super("There is no vote to undo.");
    this.name = "NothingToUndoError";
  }
}

export function createRankingSession(
  catalog: PlayerCatalog,
  selection: RankingSelection,
  options: {
    readonly now?: () => Date;
    readonly randomUint32?: () => number;
    readonly randomUuid?: () => string;
  } = {},
): PersistedRankingSessionV1 {
  const sizes = PRESET_SIZES[selection.preset];
  const pool = catalog.playerIdsByPool[sizes.poolSize];
  const playerOrder = secureShuffle(pool, options.randomUint32);
  const now = (options.now ?? (() => new Date()))().toISOString();
  const randomUuid = options.randomUuid ?? (() => crypto.randomUUID());
  const session: PersistedRankingSessionV1 = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    algorithmVersion: RANKING_ALGORITHM_VERSION,
    id: randomUuid(),
    catalogId: catalog.catalogId,
    preset: selection.preset,
    identityMode: selection.identityMode,
    playerOrder,
    outcomes: [],
    revision: 0,
    lastMutationId: randomUuid(),
    createdAt: now,
    updatedAt: now,
  };
  validateSessionCatalog(session, catalog);
  validatePersistedSession(session);
  return session;
}

export function rankingStateFor(
  session: PersistedRankingSessionV1,
): RankingState {
  return replayRanking(
    session.playerOrder,
    PRESET_SIZES[session.preset].targetSize,
    session.outcomes,
  );
}

export function applySessionVote(
  session: PersistedRankingSessionV1,
  outcome: VoteOutcome,
  options: {
    readonly now?: () => Date;
    readonly randomUuid?: () => string;
  } = {},
): PersistedRankingSessionV1 {
  if (isRankingComplete(rankingStateFor(session))) {
    throw new RankingCompleteError();
  }
  return nextSession(
    session,
    [...session.outcomes, outcome],
    options,
  );
}

export function undoSessionVote(
  session: PersistedRankingSessionV1,
  options: {
    readonly now?: () => Date;
    readonly randomUuid?: () => string;
  } = {},
): PersistedRankingSessionV1 {
  if (session.outcomes.length === 0) {
    throw new NothingToUndoError();
  }
  return nextSession(session, session.outcomes.slice(0, -1), options);
}

export function validateSessionCatalog(
  session: PersistedRankingSessionV1,
  catalog: PlayerCatalog,
): void {
  if (catalog.catalogId !== session.catalogId) {
    throw new Error("Saved ranking catalog does not match.");
  }
  const expectedPool = new Set(
    catalog.playerIdsByPool[PRESET_SIZES[session.preset].poolSize],
  );
  if (
    expectedPool.size !== session.playerOrder.length ||
    session.playerOrder.some((playerId) => !expectedPool.has(playerId))
  ) {
    throw new Error(
      "Saved ranking players do not match the immutable catalog pool.",
    );
  }
}

export function secureShuffle<T>(
  values: readonly T[],
  randomUint32: () => number = cryptoUint32,
): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const selected = unbiasedIndex(index + 1, randomUint32);
    [shuffled[index], shuffled[selected]] = [
      shuffled[selected],
      shuffled[index],
    ];
  }
  return shuffled;
}

function nextSession(
  session: PersistedRankingSessionV1,
  outcomes: readonly VoteOutcome[],
  options: {
    readonly now?: () => Date;
    readonly randomUuid?: () => string;
  },
): PersistedRankingSessionV1 {
  const next: PersistedRankingSessionV1 = {
    ...session,
    outcomes,
    revision: session.revision + 1,
    lastMutationId: (options.randomUuid ?? (() => crypto.randomUUID()))(),
    updatedAt: (options.now ?? (() => new Date()))().toISOString(),
  };
  validatePersistedSession(next);
  return next;
}

function unbiasedIndex(
  upperBound: number,
  randomUint32: () => number,
): number {
  const range = 0x1_0000_0000;
  const limit = Math.floor(range / upperBound) * upperBound;
  let value: number;
  do {
    value = randomUint32();
    if (
      !Number.isInteger(value) ||
      value < 0 ||
      value >= range
    ) {
      throw new Error("Random source must return an unsigned 32-bit integer.");
    }
  } while (value >= limit);
  return value % upperBound;
}

function cryptoUint32(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] ?? 0;
}
