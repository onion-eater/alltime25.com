import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearCatalogCacheForTests,
  loadCatalog,
  loadCurrentCatalog,
} from "@/features/ranking/catalog/catalogRepository";

const CATALOG_ID = "test-catalog";

describe("catalogRepository", () => {
  beforeEach(() => {
    clearCatalogCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the current catalog in parallel and caches it", async () => {
    const payloads = validPayloads();
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const path = requestPath(input);
      if (path === "/data/current.json") {
        return Promise.resolve(jsonResponse({ catalog_id: CATALOG_ID }));
      }
      if (path.endsWith("/players.json")) {
        return Promise.resolve(jsonResponse(payloads.players));
      }
      if (path.endsWith("/pools.json")) {
        return Promise.resolve(jsonResponse(payloads.pools));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const catalog = await loadCurrentCatalog();
    const cached = await loadCatalog(CATALOG_ID);

    expect(catalog).toBe(cached);
    expect(catalog.playersById).toHaveLength(100);
    expect(catalog.playerIdsByPool[25]).toHaveLength(25);
    expect(catalog.playerIdsByPool[50]).toHaveLength(50);
    expect(catalog.playerIdsByPool[100]).toHaveLength(100);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("loads an immutable stored catalog without reading current", async () => {
    const payloads = validPayloads();
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const path = requestPath(input);
      return Promise.resolve(
        jsonResponse(
          path.endsWith("/players.json")
            ? payloads.players
            : payloads.pools,
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await loadCatalog(CATALOG_ID);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/data/current.json",
      expect.anything(),
    );
  });

  it("rejects unsafe catalog IDs before fetching", () => {
    vi.stubGlobal("fetch", vi.fn());

    expect(() => loadCatalog("../private")).toThrow(/invalid format/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not cache failed catalog requests", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 503 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadCatalog(CATALOG_ID)).rejects.toThrow(/503/);
    await expect(loadCatalog(CATALOG_ID)).rejects.toThrow(/503/);

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("rejects duplicate players and non-nested pools", async () => {
    const duplicatePayloads = validPayloads();
    duplicatePayloads.players.players[1] =
      duplicatePayloads.players.players[0];
    await expectLoadingFailure(duplicatePayloads, /unique/i);

    const nonNestedPayloads = validPayloads();
    nonNestedPayloads.pools.pools["25"][0] = "player-075";
    await expectLoadingFailure(nonNestedPayloads, /nested/i);
  });

  it("rejects invalid statistics, awards, dates, and image paths", async () => {
    const invalidPercentage = validPayloads();
    invalidPercentage.players.players[0].regular_season.three_pct = 101;
    await expectLoadingFailure(invalidPercentage, /between 0 and 100/i);

    const invalidAward = validPayloads();
    invalidAward.players.players[0].honors.championships = 0;
    invalidAward.players.players[0].honors.finals_mvp = 1;
    await expectLoadingFailure(invalidAward, /cannot exceed/i);

    const invalidDate = validPayloads();
    invalidDate.players.players[0].as_of = "2025-01-01";
    await expectLoadingFailure(invalidDate, /mismatched catalog date/i);

    const invalidImage = validPayloads();
    invalidImage.players.players[0].image_path = "/private/player.webp";
    await expectLoadingFailure(invalidImage, /image path/i);
  });
});

async function expectLoadingFailure(
  payloads: ReturnType<typeof validPayloads>,
  message: RegExp,
): Promise<void> {
  clearCatalogCacheForTests();
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string | URL | Request) =>
      Promise.resolve(
        jsonResponse(
          requestPath(input).endsWith("/players.json")
            ? payloads.players
            : payloads.pools,
        ),
      ),
    ),
  );
  await expect(loadCatalog(CATALOG_ID)).rejects.toThrow(message);
}

function validPayloads(): {
  players: {
    catalog_id: string;
    as_of: string;
    players: ReturnType<typeof playerRecord>[];
  };
  pools: {
    catalog_id: string;
    pools: Record<"25" | "50" | "100", string[]>;
  };
} {
  const playerIds = Array.from(
    { length: 100 },
    (_, index) => `player-${String(index).padStart(3, "0")}`,
  );
  return {
    players: {
      catalog_id: CATALOG_ID,
      as_of: "2026-06-30",
      players: playerIds.map(playerRecord),
    },
    pools: {
      catalog_id: CATALOG_ID,
      pools: {
        "25": playerIds.slice(0, 25),
        "50": playerIds.slice(0, 50),
        "100": playerIds,
      },
    },
  };
}

function playerRecord(id: string) {
  return {
    id,
    name: `Player ${id}`,
    era: "2000s",
    seasons: 10,
    regular_season: stats(820),
    playoffs: stats(100),
    honors: {
      mvp: 0,
      all_nba: 0,
      dpoy: 0,
      championships: 0,
      finals_mvp: 0,
    },
    image_path: `/assets/catalogs/${CATALOG_ID}/players/${id}.webp`,
    as_of: "2026-06-30",
    source_note: "Test fixture.",
  };
}

function stats(games: number) {
  return {
    games,
    ppg: 20,
    rpg: 5,
    apg: 5,
    spg: 1,
    bpg: 1,
    fg_pct: 50,
    three_pct: 35,
    ft_pct: 80,
  };
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function requestPath(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.pathname : input.url;
}
