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
        era: "1990s",
        seasons: 15,
        regular_season: stats,
        playoffs: { ...stats, games: 179, ppg: 33.4 },
        honors,
      },
      player_b: {
        label: "Player B",
        code: "#077",
        era: "2010s",
        seasons: 21,
        regular_season: { ...stats, games: 1492, ppg: 27.1 },
        playoffs: { ...stats, games: 287, ppg: 28.4 },
        honors: { ...honors, mvp: 4, all_nba: 20 },
      },
    },
    ranking: null,
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
    ],
  };
}
