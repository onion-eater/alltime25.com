import type {
  AnonymousPlayerResponse,
  CareerStatsResponse,
  HonorsResponse,
} from "@/features/ranking/api/rankingApi";

export interface ComparisonRow {
  label: string;
  valueA: string;
  valueB: string;
}

export interface ComparisonSection {
  label: "Career" | "Regular Season" | "Playoffs" | "Honors";
  rows: readonly ComparisonRow[];
}

const CAREER_STATS: readonly {
  key: Exclude<keyof CareerStatsResponse, "games">;
  label: string;
  percentage?: boolean;
}[] = [
  { key: "ppg", label: "PTS" },
  { key: "rpg", label: "REB" },
  { key: "apg", label: "AST" },
  { key: "spg", label: "STL" },
  { key: "bpg", label: "BLK" },
  { key: "fg_pct", label: "FG%", percentage: true },
  { key: "three_pct", label: "3PT%", percentage: true },
  { key: "ft_pct", label: "FT%", percentage: true },
];

const HONORS: readonly {
  key: keyof HonorsResponse;
  label: string;
}[] = [
  { key: "mvp", label: "MVP" },
  { key: "all_nba", label: "All-NBA" },
  { key: "dpoy", label: "DPOY" },
  { key: "championships", label: "Titles" },
  { key: "finals_mvp", label: "Finals MVP" },
];

export function comparisonSections(
  playerA: AnonymousPlayerResponse,
  playerB: AnonymousPlayerResponse,
): readonly ComparisonSection[] {
  return [
    {
      label: "Career",
      rows: [
        {
          label: "Era",
          valueA: playerA.era,
          valueB: playerB.era,
        },
        {
          label: "Seasons",
          valueA: String(playerA.seasons),
          valueB: String(playerB.seasons),
        },
      ],
    },
    {
      label: "Honors",
      rows: HONORS.map(({ key, label }) => ({
        label,
        valueA: formatCount(playerA.honors[key]),
        valueB: formatCount(playerB.honors[key]),
      })),
    },
    statsSection(
      "Regular Season",
      playerA.regular_season,
      playerB.regular_season,
    ),
    statsSection("Playoffs", playerA.playoffs, playerB.playoffs),
  ];
}

function statsSection(
  label: "Regular Season" | "Playoffs",
  statsA: CareerStatsResponse,
  statsB: CareerStatsResponse,
): ComparisonSection {
  return {
    label,
    rows: [
      {
        label: "Games",
        valueA: String(statsA.games),
        valueB: String(statsB.games),
      },
      ...CAREER_STATS.map(({ key, label: rowLabel, percentage }) => ({
        label: rowLabel,
        valueA: formatStat(statsA[key], percentage),
        valueB: formatStat(statsB[key], percentage),
      })),
    ],
  };
}

function formatStat(
  value: number | null,
  percentage = false,
): string {
  if (value === null) return "—";
  return percentage ? `${value.toFixed(1)}%` : value.toFixed(1);
}

function formatCount(value: number | null): string {
  return value === null ? "—" : String(value);
}
