import { act, renderHook, waitFor } from "@testing-library/react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { PlayerCatalog } from "@/features/ranking/catalog/catalogRepository";
import type { PlayerResume } from "@/features/ranking/domain/player";
import { useRankingSession } from "@/features/ranking/hooks/useRankingSession";
import {
  SESSION_STORAGE_KEY,
  readPersistedSession,
  writePersistedSession,
} from "@/features/ranking/persistence/persistedSession";
import {
  applySessionVote,
  createRankingSession,
} from "@/features/ranking/session/rankingSession";

const catalogMocks = vi.hoisted(() => ({
  loadCatalog: vi.fn(),
  loadCurrentCatalog: vi.fn(),
}));

vi.mock("@/features/ranking/catalog/catalogRepository", () => ({
  loadCatalog: catalogMocks.loadCatalog,
  loadCurrentCatalog: catalogMocks.loadCurrentCatalog,
}));

describe("useRankingSession", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    const value = catalog();
    catalogMocks.loadCatalog.mockReset();
    catalogMocks.loadCurrentCatalog.mockReset();
    catalogMocks.loadCatalog.mockImplementation((catalogId: string) =>
      catalogId === value.catalogId
        ? Promise.resolve(value)
        : Promise.reject(new Error("Saved ranking catalog is unavailable.")),
    );
    catalogMocks.loadCurrentCatalog.mockResolvedValue(value);
    installWebLocks();
  });

  it("creates and persists a fresh Top 25 / Normal ranking", async () => {
    const { result } = renderHook(() => useRankingSession());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.session).toMatchObject({
      preset: "top_25",
      identityMode: "normal",
      poolSize: 50,
      targetSize: 25,
      revision: 0,
    });
    expect(readPersistedSession()?.playerOrder).toHaveLength(50);
  });

  it("waits for first-run mode selection before creating a ranking", async () => {
    const { result } = renderHook(() =>
      useRankingSession({ deferInitialCreation: true }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.session).toBeNull();
    expect(readPersistedSession()).toBeNull();
    expect(catalogMocks.loadCurrentCatalog).not.toHaveBeenCalled();
  });

  it("restores the exact stored catalog, mode, order, and vote history", async () => {
    const stored = applySessionVote(
      createRankingSession(catalog(), {
        preset: "top_10",
        identityMode: "blind",
      }),
      "tie",
    );
    writePersistedSession(stored);

    const { result } = renderHook(() => useRankingSession());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.session).toMatchObject({
      id: stored.id,
      preset: "top_10",
      identityMode: "blind",
      revision: 1,
      canUndo: true,
    });
    expect(result.current.session?.comparison?.playerA).not.toHaveProperty(
      "name",
    );
    expect(catalogMocks.loadCurrentCatalog).not.toHaveBeenCalled();
  });

  it("persists a vote before changing the rendered comparison", async () => {
    const { result } = renderHook(() => useRankingSession());
    await waitFor(() => expect(result.current.session).not.toBeNull());
    const before = result.current.session?.comparison;

    await act(() => result.current.vote("better"));

    expect(result.current.session?.revision).toBe(1);
    expect(result.current.session?.comparison).not.toEqual(before);
    expect(readPersistedSession()?.outcomes).toEqual(["better"]);
  });

  it("persists undo and permits a new branch", async () => {
    const { result } = renderHook(() => useRankingSession());
    await waitFor(() => expect(result.current.session).not.toBeNull());

    await act(() => result.current.vote("better"));
    await act(() => result.current.undo());
    await act(() => result.current.vote("worse"));

    expect(readPersistedSession()).toMatchObject({
      outcomes: ["worse"],
      revision: 3,
    });
  });

  it("blocks a duplicate click while the first mutation owns the lock", async () => {
    let release: (() => void) | undefined;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    let requests = 0;
    installWebLocks(async (callback) => {
      requests += 1;
      if (requests > 1) await barrier;
      return callback();
    });
    const { result } = renderHook(() => useRankingSession());
    await waitFor(() => expect(result.current.session).not.toBeNull());

    let first: Promise<void>;
    act(() => {
      first = result.current.vote("tie");
      void result.current.vote("better");
    });
    await act(async () => {
      release?.();
      await first;
    });

    expect(readPersistedSession()?.outcomes).toEqual(["tie"]);
  });

  it("keeps the current ranking when a restart write fails", async () => {
    const { result } = renderHook(() => useRankingSession());
    await waitFor(() => expect(result.current.session).not.toBeNull());
    const prior = result.current.session;
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Full", "QuotaExceededError");
      });

    let restarted = true;
    await act(async () => {
      restarted = await result.current.startNewRanking({
        preset: "top_10",
        identityMode: "blind",
      });
    });

    expect(restarted).toBe(false);
    expect(result.current.session).toEqual(prior);
    expect(result.current.error).toMatch(/could not be saved/i);
    setItem.mockRestore();
  });

  it("leaves corrupt progress intact until an explicit restart replaces it", async () => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, "{broken");
    const { result } = renderHook(() => useRankingSession());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.session).toBeNull();
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBe("{broken");

    let restarted = false;
    await act(async () => {
      restarted = await result.current.startNewRanking({
        preset: "top_25",
        identityMode: "normal",
      });
    });

    expect(restarted).toBe(true);
    expect(result.current.session?.preset).toBe("top_25");
    expect(readPersistedSession()).not.toBeNull();
  });

  it("can restart when a saved immutable catalog is no longer shipped", async () => {
    const stored = {
      ...createRankingSession(catalog(), {
        preset: "top_25",
        identityMode: "normal",
      }),
      catalogId: "retired-catalog",
    };
    writePersistedSession(stored);
    const { result } = renderHook(() => useRankingSession());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toMatch(/catalog is unavailable/i);

    await act(() =>
      result.current.startNewRanking({
        preset: "top_10",
        identityMode: "blind",
      }),
    );

    expect(result.current.session).toMatchObject({
      catalogId: "test-catalog",
      preset: "top_10",
      identityMode: "blind",
    });
  });

  it("adopts a newer storage revision from another tab", async () => {
    const { result } = renderHook(() => useRankingSession());
    await waitFor(() => expect(result.current.session).not.toBeNull());
    const current = readPersistedSession();
    if (current === null) throw new Error("Missing stored session.");
    const updated = applySessionVote(current, "tie");
    writePersistedSession(updated);

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: SESSION_STORAGE_KEY,
          newValue: JSON.stringify(updated),
        }),
      );
    });

    await waitFor(() =>
      expect(result.current.session?.revision).toBe(updated.revision),
    );
    expect(result.current.statusMessage).toBe(
      "Updated from another tab.",
    );
  });

  it("preserves the display after another tab clears storage, then starts fresh on action", async () => {
    const { result } = renderHook(() => useRankingSession());
    await waitFor(() => expect(result.current.session).not.toBeNull());
    const prior = result.current.session;
    window.localStorage.removeItem(SESSION_STORAGE_KEY);

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: SESSION_STORAGE_KEY,
          newValue: null,
        }),
      );
    });
    expect(result.current.session).toEqual(prior);

    await act(() => result.current.vote("tie"));

    expect(result.current.session?.id).not.toBe(prior?.id);
    expect(result.current.session).toMatchObject({
      preset: prior?.preset,
      identityMode: prior?.identityMode,
      revision: 0,
    });
  });

  it("reports browsers without Web Locks instead of using unsafe persistence", async () => {
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: undefined,
    });
    const { result } = renderHook(() => useRankingSession());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.session).toBeNull();
    expect(result.current.error).toMatch(/cannot safely save/i);
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it("removes legacy server-session keys during first client startup", async () => {
    window.localStorage.setItem("alltime25.session_id", "server-id");
    window.localStorage.setItem("alltime25.session_version", "9");
    window.localStorage.setItem(
      "alltime25.pending_create_operation",
      "operation",
    );
    window.localStorage.setItem(
      "alltime25.ranking_selection",
      "selection",
    );

    const { result } = renderHook(() => useRankingSession());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(window.localStorage.getItem("alltime25.session_id")).toBeNull();
    expect(
      window.localStorage.getItem("alltime25.session_version"),
    ).toBeNull();
    expect(
      window.localStorage.getItem("alltime25.pending_create_operation"),
    ).toBeNull();
    expect(
      window.localStorage.getItem("alltime25.ranking_selection"),
    ).toBeNull();
  });
});

function installWebLocks(
  run: <T>(
    callback: () => T | Promise<T>,
  ) => T | Promise<T> = (callback) => callback(),
): void {
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: vi.fn(
        <T,>(
          _name: string,
          callback: () => T | Promise<T>,
        ): T | Promise<T> => run(callback),
      ),
    },
  });
}

function catalog(): PlayerCatalog {
  const playerIds = Array.from(
    { length: 100 },
    (_, index) => `player-${String(index).padStart(3, "0")}`,
  );
  const players = playerIds.map(player);
  return {
    catalogId: "test-catalog",
    asOf: "2026-06-30",
    playersById: new Map(players.map((resume) => [resume.id, resume])),
    playerIdsByPool: {
      25: playerIds.slice(0, 25),
      50: playerIds.slice(0, 50),
      100: playerIds,
    },
  };
}

function player(id: string): PlayerResume {
  const stats = {
    games: 100,
    ppg: 20,
    rpg: 5,
    apg: 5,
    spg: 1,
    bpg: 1,
    fgPct: 50,
    threePct: 35,
    ftPct: 80,
  };
  return {
    id,
    name: `Player ${id}`,
    era: "2000s",
    seasons: 10,
    regularSeason: stats,
    playoffs: stats,
    honors: {
      mvp: 0,
      allNba: 0,
      dpoy: 0,
      championships: 0,
      finalsMvp: 0,
    },
    imagePath: `/assets/catalogs/test-catalog/players/${id}.webp`,
    asOf: "2026-06-30",
    sourceNote: "Test fixture.",
  };
}
