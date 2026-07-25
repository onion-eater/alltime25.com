import {
  isIdentityMode,
  isRankingPreset,
  PRESET_SIZES,
  type IdentityMode,
  type RankingPreset,
} from "@/features/ranking/domain/player";
import {
  maximumComparisons,
  replayRanking,
  type VoteOutcome,
} from "@/features/ranking/domain/ranking";

export const SESSION_STORAGE_KEY = "alltime25.ranking-session.v1";
export const SESSION_SCHEMA_VERSION = 1;
export const RANKING_ALGORITHM_VERSION = 1;

export const LEGACY_SESSION_KEYS = [
  "alltime25.session_id",
  "alltime25.session_version",
  "alltime25.pending_create_operation",
  "alltime25.ranking_selection",
] as const;

export interface PersistedRankingSessionV1 {
  readonly schemaVersion: 1;
  readonly algorithmVersion: 1;
  readonly id: string;
  readonly catalogId: string;
  readonly preset: RankingPreset;
  readonly identityMode: IdentityMode;
  readonly playerOrder: readonly string[];
  readonly outcomes: readonly VoteOutcome[];
  readonly revision: number;
  readonly lastMutationId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class RankingStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RankingStorageError";
  }
}

export class CorruptRankingSessionError extends RankingStorageError {
  constructor(
    message = "Saved ranking could not be read.",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CorruptRankingSessionError";
  }
}

export function readPersistedSession(): PersistedRankingSessionV1 | null {
  const raw = readPersistedSessionRaw();
  if (raw === null) return null;
  return parsePersistedSession(raw);
}

export function readPersistedSessionRaw(): string | null {
  try {
    return window.localStorage.getItem(SESSION_STORAGE_KEY);
  } catch (error) {
    throw new RankingStorageError(
      "Local saving is unavailable in this browser.",
      { cause: error },
    );
  }
}

export function writePersistedSession(
  session: PersistedRankingSessionV1,
): void {
  validatePersistedSession(session);
  let serialized: string;
  try {
    serialized = JSON.stringify(session);
    window.localStorage.setItem(SESSION_STORAGE_KEY, serialized);
    const saved = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (saved === null) {
      throw new Error("Saved ranking is missing after write.");
    }
    const verified = parsePersistedSession(saved);
    if (verified.lastMutationId !== session.lastMutationId) {
      throw new Error("Saved ranking was replaced before verification.");
    }
  } catch (error) {
    if (error instanceof CorruptRankingSessionError) throw error;
    throw new RankingStorageError("Progress could not be saved.", {
      cause: error,
    });
  }
}

export function parsePersistedSession(
  raw: string,
): PersistedRankingSessionV1 {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new CorruptRankingSessionError(
      "Saved ranking contains invalid JSON.",
      { cause: error },
    );
  }
  validatePersistedSession(value);
  return clonePersistedSession(value);
}

export function validatePersistedSession(
  value: unknown,
): asserts value is PersistedRankingSessionV1 {
  if (!isRecord(value)) {
    throw new CorruptRankingSessionError();
  }
  if (value.schemaVersion !== SESSION_SCHEMA_VERSION) {
    throw new CorruptRankingSessionError(
      "Saved ranking uses an unsupported storage version.",
    );
  }
  if (value.algorithmVersion !== RANKING_ALGORITHM_VERSION) {
    throw new CorruptRankingSessionError(
      "Saved ranking uses an unsupported ranking version.",
    );
  }
  const id = requiredString(value, "id");
  const catalogId = requiredString(value, "catalogId");
  const lastMutationId = requiredString(value, "lastMutationId");
  if (
    !isUuid(id) ||
    !isUuid(lastMutationId) ||
    !/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(catalogId)
  ) {
    throw new CorruptRankingSessionError(
      "Saved ranking contains invalid identifiers.",
    );
  }
  if (!isRankingPreset(value.preset)) {
    throw new CorruptRankingSessionError(
      "Saved ranking contains an invalid preset.",
    );
  }
  if (!isIdentityMode(value.identityMode)) {
    throw new CorruptRankingSessionError(
      "Saved ranking contains an invalid identity mode.",
    );
  }
  if (
    !Array.isArray(value.playerOrder) ||
    !value.playerOrder.every(
      (playerId) => typeof playerId === "string" && playerId.length > 0,
    )
  ) {
    throw new CorruptRankingSessionError(
      "Saved ranking contains an invalid player order.",
    );
  }
  const expectedPoolSize = PRESET_SIZES[value.preset].poolSize;
  if (
    value.playerOrder.length !== expectedPoolSize ||
    new Set(value.playerOrder).size !== value.playerOrder.length
  ) {
    throw new CorruptRankingSessionError(
      "Saved ranking player order does not match its preset.",
    );
  }
  if (
    !Array.isArray(value.outcomes) ||
    !value.outcomes.every(isVoteOutcome)
  ) {
    throw new CorruptRankingSessionError(
      "Saved ranking contains an invalid vote history.",
    );
  }
  const maximum = maximumComparisons(
    expectedPoolSize,
    PRESET_SIZES[value.preset].targetSize,
  );
  if (value.outcomes.length > maximum) {
    throw new CorruptRankingSessionError(
      "Saved ranking exceeds the comparison limit.",
    );
  }
  if (!Number.isInteger(value.revision) || (value.revision as number) < 0) {
    throw new CorruptRankingSessionError(
      "Saved ranking contains an invalid revision.",
    );
  }
  const createdAt = validTimestamp(value, "createdAt");
  const updatedAt = validTimestamp(value, "updatedAt");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw new CorruptRankingSessionError(
      "Saved ranking timestamps are inconsistent.",
    );
  }
  try {
    replayRanking(
      value.playerOrder,
      PRESET_SIZES[value.preset].targetSize,
      value.outcomes,
    );
  } catch (error) {
    throw new CorruptRankingSessionError(
      "Saved ranking contains an invalid vote history.",
      { cause: error },
    );
  }
}

export function clearLegacySessionKeys(): void {
  try {
    for (const key of LEGACY_SESSION_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch (error) {
    throw new RankingStorageError(
      "Local saving is unavailable in this browser.",
      { cause: error },
    );
  }
}

function clonePersistedSession(
  session: PersistedRankingSessionV1,
): PersistedRankingSessionV1 {
  return {
    ...session,
    playerOrder: [...session.playerOrder],
    outcomes: [...session.outcomes],
  };
}

function requiredString(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CorruptRankingSessionError(
      `Saved ranking ${key} is invalid.`,
    );
  }
  return value;
}

function validTimestamp(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = requiredString(record, key);
  if (!Number.isFinite(Date.parse(value))) {
    throw new CorruptRankingSessionError(
      `Saved ranking ${key} is invalid.`,
    );
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isVoteOutcome(value: unknown): value is VoteOutcome {
  return value === "better" || value === "tie" || value === "worse";
}
