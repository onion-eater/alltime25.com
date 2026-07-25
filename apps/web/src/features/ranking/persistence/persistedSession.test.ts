import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearLegacySessionKeys,
  CorruptRankingSessionError,
  LEGACY_SESSION_KEYS,
  parsePersistedSession,
  RankingStorageError,
  readPersistedSession,
  SESSION_STORAGE_KEY,
  writePersistedSession,
  type PersistedRankingSessionV1,
} from "@/features/ranking/persistence/persistedSession";

describe("persistedSession", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("round-trips one compact authoritative session", () => {
    const session = validSession();

    writePersistedSession(session);

    expect(readPersistedSession()).toEqual(session);
    expect(localStorage).toHaveLength(1);
    expect(
      localStorage.getItem(SESSION_STORAGE_KEY)?.length,
    ).toBeLessThan(10_000);
  });

  it("rejects corrupt JSON without removing it", () => {
    localStorage.setItem(SESSION_STORAGE_KEY, "{broken");

    expect(() => readPersistedSession()).toThrow(
      CorruptRankingSessionError,
    );
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBe("{broken");
  });

  it("rejects unknown versions, invalid players, and extra votes", () => {
    expect(() =>
      parsePersistedSession(
        JSON.stringify({ ...validSession(), schemaVersion: 2 }),
      ),
    ).toThrow(/storage version/i);
    expect(() =>
      parsePersistedSession(
        JSON.stringify({
          ...validSession(),
          playerOrder: Array(50).fill("duplicate"),
        }),
      ),
    ).toThrow(/player order/i);
    expect(() =>
      parsePersistedSession(
        JSON.stringify({
          ...validSession(),
          outcomes: Array(500).fill("tie"),
        }),
      ),
    ).toThrow(/comparison limit/i);

    const topTen = validSession("top_10");
    expect(() =>
      parsePersistedSession(
        JSON.stringify({
          ...topTen,
          outcomes: Array(25).fill("tie"),
        }),
      ),
    ).toThrow(/vote history/i);
  });

  it("leaves the previous session intact when writing fails", () => {
    const previous = validSession();
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(previous));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });

    expect(() =>
      writePersistedSession({
        ...previous,
        revision: 1,
        lastMutationId: "22222222-2222-4222-8222-222222222222",
      }),
    ).toThrow(RankingStorageError);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBe(
      JSON.stringify(previous),
    );
  });

  it("removes only legacy server session keys", () => {
    for (const key of LEGACY_SESSION_KEYS) {
      localStorage.setItem(key, "legacy");
    }
    localStorage.setItem("alltime25.help_seen", "1");

    clearLegacySessionKeys();

    for (const key of LEGACY_SESSION_KEYS) {
      expect(localStorage.getItem(key)).toBeNull();
    }
    expect(localStorage.getItem("alltime25.help_seen")).toBe("1");
  });
});

function validSession(
  preset: "top_10" | "top_25" | "top_50" = "top_25",
): PersistedRankingSessionV1 {
  const poolSize =
    preset === "top_10" ? 25 : preset === "top_25" ? 50 : 100;
  return {
    schemaVersion: 1,
    algorithmVersion: 1,
    id: "11111111-1111-4111-8111-111111111111",
    catalogId: "test-catalog",
    preset,
    identityMode: "normal",
    playerOrder: Array.from(
      { length: poolSize },
      (_, index) => `player-${index}`,
    ),
    outcomes: [],
    revision: 0,
    lastMutationId: "22222222-2222-4222-8222-222222222222",
    createdAt: "2026-07-25T00:00:00.000Z",
    updatedAt: "2026-07-25T00:00:00.000Z",
  };
}
