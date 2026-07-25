import { describe, expect, it } from "vitest";

import type { PlayerCatalog } from "@/features/ranking/catalog/catalogRepository";
import type { PlayerResume } from "@/features/ranking/domain/player";
import { isRankingComplete } from "@/features/ranking/domain/ranking";
import {
  applySessionVote,
  createRankingSession,
  NothingToUndoError,
  RankingCompleteError,
  rankingStateFor,
  secureShuffle,
  undoSessionVote,
  validateSessionCatalog,
} from "@/features/ranking/session/rankingSession";

const UUIDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
] as const;

describe("rankingSession", () => {
  it("creates a shuffled Top 25 / Normal session by default selection", () => {
    let uuidIndex = 0;
    const session = createRankingSession(
      catalog(),
      { preset: "top_25", identityMode: "normal" },
      {
        now: () => new Date("2026-07-25T00:00:00.000Z"),
        randomUint32: () => 0,
        randomUuid: () => UUIDS[uuidIndex++] ?? UUIDS[2],
      },
    );

    expect(session.playerOrder).toHaveLength(50);
    expect(session.playerOrder).not.toEqual(
      catalog().playerIdsByPool[50],
    );
    expect(new Set(session.playerOrder)).toEqual(
      new Set(catalog().playerIdsByPool[50]),
    );
    expect(session.outcomes).toEqual([]);
    expect(session.revision).toBe(0);
  });

  it("persists votes as outcomes and reconstructs exact undo state", () => {
    const created = createSession();
    const firstState = rankingStateFor(created);
    const voted = applySessionVote(created, "tie", {
      now: () => new Date("2026-07-25T00:01:00.000Z"),
      randomUuid: () => UUIDS[2],
    });

    expect(voted.outcomes).toEqual(["tie"]);
    expect(voted.revision).toBe(1);
    expect(rankingStateFor(voted)).not.toEqual(firstState);

    const undone = undoSessionVote(voted, {
      now: () => new Date("2026-07-25T00:02:00.000Z"),
      randomUuid: () => UUIDS[1],
    });

    expect(undone.outcomes).toEqual([]);
    expect(undone.revision).toBe(2);
    expect(rankingStateFor(undone)).toEqual(firstState);
  });

  it("supports a new branch after undo", () => {
    const created = createSession();
    const first = applySessionVote(created, "better", {
      randomUuid: () => UUIDS[2],
    });
    const undone = undoSessionVote(first, {
      randomUuid: () => UUIDS[1],
    });
    const branch = applySessionVote(undone, "worse", {
      randomUuid: () => UUIDS[2],
    });

    expect(branch.outcomes).toEqual(["worse"]);
    expect(branch.revision).toBe(3);
  });

  it("rejects undo before a vote and votes after completion", () => {
    expect(() => undoSessionVote(createSession())).toThrow(
      NothingToUndoError,
    );

    let session = createRankingSession(
      catalog(),
      { preset: "top_10", identityMode: "blind" },
      deterministicOptions(),
    );
    while (!isRankingComplete(rankingStateFor(session))) {
      session = applySessionVote(session, "tie", {
        randomUuid: () => UUIDS[2],
      });
    }
    expect(() => applySessionVote(session, "tie")).toThrow(
      RankingCompleteError,
    );
  });

  it("validates the immutable pool for a restored session", () => {
    const session = createSession();
    const wrongCatalog = catalog();
    const wrongPool = [...wrongCatalog.playerIdsByPool[50]];
    wrongPool[0] = "player-099";

    expect(() =>
      validateSessionCatalog(session, {
        ...wrongCatalog,
        playerIdsByPool: {
          ...wrongCatalog.playerIdsByPool,
          50: wrongPool,
        },
      }),
    ).toThrow(/immutable catalog pool/i);
  });

  it("uses rejection sampling for an unbiased shuffle index", () => {
    const values = [0xffff_ffff, 1];
    const shuffled = secureShuffle(["a", "b", "c"], () => {
      const value = values.shift();
      return value ?? 0;
    });

    expect(shuffled).toHaveLength(3);
    expect(new Set(shuffled)).toEqual(new Set(["a", "b", "c"]));
  });
});

function createSession() {
  return createRankingSession(
    catalog(),
    { preset: "top_25", identityMode: "normal" },
    deterministicOptions(),
  );
}

function deterministicOptions() {
  let uuidIndex = 0;
  return {
    now: () => new Date("2026-07-25T00:00:00.000Z"),
    randomUint32: () => 0,
    randomUuid: () => UUIDS[uuidIndex++] ?? UUIDS[2],
  };
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
    name: id,
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
