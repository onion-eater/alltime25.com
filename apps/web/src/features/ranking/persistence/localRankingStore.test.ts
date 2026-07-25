import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mutateStoredSession,
  RANKING_LOCK_NAME,
  sessionExpectation,
  UnsupportedRankingBrowserError,
} from "@/features/ranking/persistence/localRankingStore";
import {
  readPersistedSession,
  SESSION_STORAGE_KEY,
  writePersistedSession,
  type PersistedRankingSessionV1,
} from "@/features/ranking/persistence/persistedSession";

const originalLocks = Object.getOwnPropertyDescriptor(navigator, "locks");

describe("localRankingStore", () => {
  beforeEach(() => {
    localStorage.clear();
    installLocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalLocks === undefined) {
      Reflect.deleteProperty(navigator, "locks");
    } else {
      Object.defineProperty(navigator, "locks", originalLocks);
    }
  });

  it("serializes a matching mutation and verifies the saved revision", async () => {
    const current = validSession();
    writePersistedSession(current);
    const next = {
      ...current,
      outcomes: ["tie"] as const,
      revision: 1,
      lastMutationId: "33333333-3333-4333-8333-333333333333",
    };

    const result = await mutateStoredSession(
      sessionExpectation(current),
      () => next,
    );

    expect(result).toEqual({ status: "saved", session: next });
    expect(readPersistedSession()).toEqual(next);
    expect(navigator.locks.request).toHaveBeenCalledWith(
      RANKING_LOCK_NAME,
      expect.any(Function),
    );
  });

  it("allows exactly one creator when storage begins empty", async () => {
    const first = validSession();

    const accepted = await mutateStoredSession(null, () => first);
    const stale = await mutateStoredSession(null, () => ({
      ...first,
      id: "44444444-4444-4444-8444-444444444444",
    }));

    expect(accepted.status).toBe("saved");
    expect(stale).toEqual({ status: "stale", session: first });
    expect(readPersistedSession()).toEqual(first);
  });

  it("does not invoke a stale tab mutation", async () => {
    const current = validSession();
    writePersistedSession(current);
    const transform = vi.fn(() => ({
      ...current,
      revision: 2,
    }));

    const result = await mutateStoredSession(
      { id: current.id, revision: 1 },
      transform,
    );

    expect(result).toEqual({ status: "stale", session: current });
    expect(transform).not.toHaveBeenCalled();
    expect(readPersistedSession()).toEqual(current);
  });

  it("does not replace the current session when persistence fails", async () => {
    const current = validSession();
    writePersistedSession(current);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });

    await expect(
      mutateStoredSession(sessionExpectation(current), () => ({
        ...current,
        revision: 1,
        lastMutationId: "33333333-3333-4333-8333-333333333333",
      })),
    ).rejects.toThrow(/could not be saved/i);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBe(
      JSON.stringify(current),
    );
  });

  it("rejects browsers without cross-tab locks", async () => {
    Reflect.deleteProperty(navigator, "locks");

    await expect(
      mutateStoredSession(null, () => validSession()),
    ).rejects.toThrow(UnsupportedRankingBrowserError);
  });
});

function installLocks(): void {
  const request = vi.fn(
    async <T>(
      _name: string,
      callback: (lock: Lock | null) => T | PromiseLike<T>,
    ): Promise<T> => callback(null),
  );
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: { request },
  });
}

function validSession(): PersistedRankingSessionV1 {
  return {
    schemaVersion: 1,
    algorithmVersion: 1,
    id: "11111111-1111-4111-8111-111111111111",
    catalogId: "test-catalog",
    preset: "top_25",
    identityMode: "normal",
    playerOrder: Array.from(
      { length: 50 },
      (_, index) => `player-${index}`,
    ),
    outcomes: [],
    revision: 0,
    lastMutationId: "22222222-2222-4222-8222-222222222222",
    createdAt: "2026-07-25T00:00:00.000Z",
    updatedAt: "2026-07-25T00:00:00.000Z",
  };
}
