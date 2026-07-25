import { describe, expect, it } from "vitest";

import type { PlayerCatalog } from "@/features/ranking/catalog/catalogRepository";
import type { PlayerResume } from "@/features/ranking/domain/player";
import { isRankingComplete } from "@/features/ranking/domain/ranking";
import {
  applySessionVote,
  createRankingSession,
  rankingStateFor,
} from "@/features/ranking/session/rankingSession";
import { buildRankingSessionView } from "@/features/ranking/session/sessionView";

describe("buildRankingSessionView", () => {
  it("shows symmetric identity fields in a Normal comparison", () => {
    const view = buildRankingSessionView(
      createSession("normal"),
      catalog(),
    );

    const playerA = view.comparison?.playerA;
    const playerB = view.comparison?.playerB;
    expect(playerA?.label).toBe("Player A");
    expect(playerB?.label).toBe("Player B");
    expect(playerA).toHaveProperty("name");
    expect(playerB).toHaveProperty("name");
    expect("imageUrl" in (playerA ?? {})).toBe(true);
    expect("imageUrl" in (playerB ?? {})).toBe(true);
  });

  it("does not pass identity fields into active Blind views", () => {
    const view = buildRankingSessionView(
      createSession("blind"),
      catalog(),
    );
    const activeMarkupData = JSON.stringify({
      comparison: view.comparison,
      rankingPreview: view.rankingPreview,
    });

    expect(activeMarkupData).not.toContain('"name"');
    expect(activeMarkupData).not.toContain('"imageUrl"');
    expect(activeMarkupData).toContain('"code":"#');
  });

  it("keeps session codes stable as votes are replayed", () => {
    const created = createSession("blind");
    const originalCodes = codesByPlayer(created);
    const voted = applySessionVote(created, "better", {
      randomUuid: () => "33333333-3333-4333-8333-333333333333",
    });
    const nextCodes = codesByPlayer(voted);

    expect(nextCodes).toEqual(originalCodes);
  });

  it("reveals every player in a cutoff tie with skipped rank semantics", () => {
    let session = createRankingSession(
      catalog(),
      { preset: "top_10", identityMode: "blind" },
      deterministicOptions(),
    );
    while (!isRankingComplete(rankingStateFor(session))) {
      session = applySessionVote(session, "tie", {
        randomUuid: () => "33333333-3333-4333-8333-333333333333",
      });
    }

    const view = buildRankingSessionView(session, catalog());

    expect(view.status).toBe("complete");
    expect(view.comparison).toBeNull();
    expect(view.rankingPreview).toBeNull();
    expect(view.ranking).toHaveLength(1);
    expect(view.ranking?.[0]).toMatchObject({ rank: 1 });
    expect(view.ranking?.[0]?.players).toHaveLength(25);
    expect(view.ranking?.[0]?.players[0]).toHaveProperty("name");
  });
});

function codesByPlayer(
  session: ReturnType<typeof createSession>,
): Map<string, string> {
  return new Map(
    session.playerOrder.map((playerId, index) => [
      playerId,
      `#${String(index + 1).padStart(3, "0")}`,
    ]),
  );
}

function createSession(identityMode: "normal" | "blind") {
  return createRankingSession(
    catalog(),
    { preset: "top_25", identityMode },
    deterministicOptions(),
  );
}

function deterministicOptions() {
  let uuidIndex = 0;
  const uuids = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
  ] as const;
  return {
    now: () => new Date("2026-07-25T00:00:00.000Z"),
    randomUint32: () => 0,
    randomUuid: () => uuids[uuidIndex++] ?? uuids[1],
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
    imagePath: `/versions/test-catalog/images/${id}.webp`,
    asOf: "2026-06-30",
    sourceNote: "Test fixture.",
  };
}
