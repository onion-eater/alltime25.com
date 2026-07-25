import type { components } from "@/shared/api/generated/schema";

export type SessionResponse = components["schemas"]["SessionResponse"];

const stats: components["schemas"]["CareerStatsResponse"] = {
  games: 1000,
  ppg: 25.4,
  rpg: 6.2,
  apg: 5.3,
  spg: 2.3,
  bpg: 0.8,
  fg_pct: 49.7,
  three_pct: 32.7,
  ft_pct: 83.5,
};

const honors: components["schemas"]["HonorsResponse"] = {
  mvp: 5,
  all_nba: 11,
  dpoy: 1,
  championships: 6,
  finals_mvp: 6,
};

export function activeSession(): SessionResponse {
  return {
    id: "session-1",
    status: "active",
    target_size: 10,
    pool_size: 10,
    version: 0,
    can_undo: true,
    catalog_id: "development-2024-06-18",
    preset: "top_25",
    identity_mode: "normal",
    progress: {
      processed: 4,
      total: 10,
      votes: 8,
      ties: 1,
      eliminated: 0,
    },
    comparison: {
      player_a: {
        label: "Player A",
        code: "#042",
        name: "Michael Jordan",
        image_url:
          "/assets/catalogs/development-2024-06-18/players/jordami01.jpg",
        era: "1990s",
        seasons: 15,
        regular_season: stats,
        playoffs: { ...stats, games: 179, ppg: 33.4 },
        honors,
      },
      player_b: {
        label: "Player B",
        code: "#077",
        name: "LeBron James",
        image_url:
          "/assets/catalogs/development-2024-06-18/players/jamesle01.jpg",
        era: "2010s",
        seasons: 21,
        regular_season: { ...stats, games: 1492, ppg: 27.1 },
        playoffs: { ...stats, games: 287, ppg: 28.4 },
        honors: { ...honors, mvp: 4, all_nba: 20 },
      },
    },
    ranking_preview: [
      {
        rank: 1,
        players: [
          {
            code: "#018",
            name: "Kareem Abdul-Jabbar",
            era: "1970s",
            image_url:
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
            image_url:
              "/assets/catalogs/development-2024-06-18/players/jordami01.jpg",
          },
        ],
      },
    ],
    ranking: null,
  };
}

export function blindSession(): SessionResponse {
  const session = activeSession();
  if (session.comparison === null) return session;
  return {
    ...session,
    identity_mode: "blind",
    comparison: {
      player_a: anonymize(session.comparison.player_a),
      player_b: anonymize(session.comparison.player_b),
    },
    ranking_preview: session.ranking_preview?.map((group) => ({
      rank: group.rank,
      players: group.players.map((player) => ({ code: player.code })),
    })) ?? null,
  };
}

function anonymize(
  player: components["schemas"]["ComparisonResponse"]["player_a"],
): components["schemas"]["ComparisonPlayerResponse"] {
  return {
    label: player.label,
    code: player.code,
    era: player.era,
    seasons: player.seasons,
    regular_season: player.regular_season,
    playoffs: player.playoffs,
    honors: player.honors,
  };
}

export function completedSession(): SessionResponse {
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
    ranking_preview: null,
    ranking: [
      {
        rank: 1,
        players: [
          {
            name: "Michael Jordan",
            era: "1990s",
            image_url:
              "/assets/catalogs/development-2024-06-18/players/jordami01.jpg",
          },
          {
            name: "LeBron James",
            era: "2010s",
            image_url:
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
            image_url:
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
            image_url:
              "/assets/catalogs/development-2024-06-18/players/birdla01.jpg",
          },
        ],
      })),
    ],
  };
}
