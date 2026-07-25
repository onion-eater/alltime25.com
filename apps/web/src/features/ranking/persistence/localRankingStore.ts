import {
  parsePersistedSession,
  readPersistedSession,
  readPersistedSessionRaw,
  writePersistedSession,
  type PersistedRankingSessionV1,
} from "@/features/ranking/persistence/persistedSession";

export const RANKING_LOCK_NAME = "alltime25.ranking-session";
export const RANKING_CHANNEL_NAME = "alltime25-ranking-session";

export interface SessionExpectation {
  readonly id: string;
  readonly revision: number;
}

export type StoredMutationResult =
  | {
      readonly status: "saved";
      readonly session: PersistedRankingSessionV1;
    }
  | {
      readonly status: "stale";
      readonly session: PersistedRankingSessionV1 | null;
    };

export class UnsupportedRankingBrowserError extends Error {
  constructor() {
    super("This browser cannot safely save rankings across tabs.");
    this.name = "UnsupportedRankingBrowserError";
  }
}

export async function mutateStoredSession(
  expected: SessionExpectation | null,
  transform: (
    current: PersistedRankingSessionV1 | null,
  ) => PersistedRankingSessionV1 | Promise<PersistedRankingSessionV1>,
): Promise<StoredMutationResult> {
  return withRankingLock(async () => {
    const current = readPersistedSession();
    if (!matchesExpectation(current, expected)) {
      return { status: "stale", session: current };
    }
    const next = await transform(current);
    writePersistedSession(next);
    return { status: "saved", session: next };
  });
}

export async function replaceCorruptStoredSession(
  expectedRaw: string,
  next: PersistedRankingSessionV1,
): Promise<StoredMutationResult> {
  return withRankingLock(() => {
    const currentRaw = readPersistedSessionRaw();
    if (currentRaw !== expectedRaw) {
      return {
        status: "stale",
        session:
          currentRaw === null ? null : parsePersistedSession(currentRaw),
      };
    }
    writePersistedSession(next);
    return { status: "saved", session: next };
  });
}

export function sessionExpectation(
  session: PersistedRankingSessionV1,
): SessionExpectation {
  return { id: session.id, revision: session.revision };
}

export function postSessionNotification(
  channel: BroadcastChannel | null,
  session: PersistedRankingSessionV1,
): void {
  channel?.postMessage({
    id: session.id,
    revision: session.revision,
  });
}

async function withRankingLock<T>(
  callback: () => T | Promise<T>,
): Promise<T> {
  if (navigator.locks === undefined) {
    throw new UnsupportedRankingBrowserError();
  }
  return navigator.locks.request(RANKING_LOCK_NAME, callback);
}

function matchesExpectation(
  current: PersistedRankingSessionV1 | null,
  expected: SessionExpectation | null,
): boolean {
  if (expected === null) return current === null;
  return (
    current?.id === expected.id &&
    current.revision === expected.revision
  );
}
