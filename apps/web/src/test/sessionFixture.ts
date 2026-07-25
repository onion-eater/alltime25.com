import type {
  AnonymousComparisonPlayer,
  ComparisonPlayer,
  RankingSessionView,
} from "@/features/ranking/session/sessionView";

const stats = {
  games: 1000,
  ppg: 25.4,
  rpg: 6.2,
  apg: 5.3,
  spg: 2.3,
  bpg: 0.8,
  fgPct: 49.7,
  threePct: 32.7,
  ftPct: 83.5,
};

const honors = {
  mvp: 5,
  allNba: 11,
  dpoy: 1,
  championships: 6,
  finalsMvp: 6,
};

export function activeSession(): RankingSessionView {
  return {
    id: "session-1",
    status: "active",
    targetSize: 10,
    poolSize: 10,
    revision: 0,
    canUndo: true,
    catalogId: "development-2024-06-18",
    preset: "top_25",
    identityMode: "normal",
    progress: {
      processed: 4,
      total: 10,
      votes: 8,
      ties: 1,
      eliminated: 0,
    },
    comparison: {
      playerA: {
        label: "Player A",
        code: "#042",
        name: "Michael Jordan",
        imageUrl:
          "/assets/catalogs/development-2024-06-18/players/jordami01.jpg",
        era: "1990s",
        seasons: 15,
        regularSeason: stats,
        playoffs: { ...stats, games: 179, ppg: 33.4 },
        honors,
      },
      playerB: {
        label: "Player B",
        code: "#077",
        name: "LeBron James",
        imageUrl:
          "/assets/catalogs/development-2024-06-18/players/jamesle01.jpg",
        era: "2010s",
        seasons: 21,
        regularSeason: { ...stats, games: 1492, ppg: 27.1 },
        playoffs: { ...stats, games: 287, ppg: 28.4 },
        honors: { ...honors, mvp: 4, allNba: 20 },
      },
    },
    rankingPreview: [
      {
        rank: 1,
        players: [
          {
            code: "#018",
            name: "Kareem Abdul-Jabbar",
            era: "1970s",
            imageUrl:
              "/assets/catalogs/development-2024-06-18/players/abdulka01.jpg",
          },
        ],
      },
      {
        rank: 2,
        players: [
          {
            code: "#042",
            name: "Michael Jordan",
            era: "1990s",
            imageUrl:
              "/assets/catalogs/development-2024-06-18/players/jordami01.jpg",
          },
        ],
      },
    ],
    ranking: null,
  };
}

export function blindSession(): RankingSessionView {
  const session = activeSession();
  if (session.comparison === null) return session;
  return {
    ...session,
    identityMode: "blind",
    comparison: {
      playerA: anonymize(session.comparison.playerA),
      playerB: anonymize(session.comparison.playerB),
    },
    rankingPreview: session.rankingPreview?.map((group) => ({
      rank: group.rank,
      players: group.players.map((player) => ({ code: player.code })),
    })) ?? null,
  };
}

function anonymize(
  player: ComparisonPlayer,
): AnonymousComparisonPlayer {
  return {
    label: player.label,
    code: player.code,
    era: player.era,
    seasons: player.seasons,
    regularSeason: player.regularSeason,
    playoffs: player.playoffs,
    honors: player.honors,
  };
}

export function completedSession(): RankingSessionView {
  return {
    ...activeSession(),
    status: "complete",
    comparison: null,
    progress: {
      processed: 10,
      total: 10,
      votes: 24,
      ties: 1,
      eliminated: 0,
    },
    rankingPreview: null,
    ranking: [
      {
        rank: 1,
        players: [
          {
            name: "Michael Jordan",
            era: "1990s",
            imageUrl:
              "/assets/catalogs/development-2024-06-18/players/jordami01.jpg",
          },
          {
            name: "LeBron James",
            era: "2010s",
            imageUrl:
              "/assets/catalogs/development-2024-06-18/players/jamesle01.jpg",
          },
        ],
      },
      {
        rank: 3,
        players: [
          {
            name: "Kareem Abdul-Jabbar",
            era: "1970s",
            imageUrl:
              "/assets/catalogs/development-2024-06-18/players/abdulka01.jpg",
          },
        ],
      },
      ...Array.from({ length: 7 }, (_, index) => ({
        rank: index + 4,
        players: [
          {
            name: `Test Player ${index + 4}`,
            era: "2000s",
            imageUrl:
              "/assets/catalogs/development-2024-06-18/players/birdla01.jpg",
          },
        ],
      })),
    ],
  };
}
