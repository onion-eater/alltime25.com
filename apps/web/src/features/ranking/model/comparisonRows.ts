import type {
  CareerStats,
  Honors,
} from "@/features/ranking/domain/player";
import type { ComparisonPlayer } from "@/features/ranking/session/sessionView";

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
  key: Exclude<keyof CareerStats, "games">;
  label: string;
  percentage?: boolean;
}[] = [
  { key: "ppg", label: "PTS" },
  { key: "rpg", label: "REB" },
  { key: "apg", label: "AST" },
  { key: "spg", label: "STL" },
  { key: "bpg", label: "BLK" },
  { key: "fgPct", label: "FG%", percentage: true },
  { key: "threePct", label: "3PT%", percentage: true },
  { key: "ftPct", label: "FT%", percentage: true },
];

const HONORS: readonly {
  key: keyof Honors;
  label: string;
}[] = [
  { key: "mvp", label: "MVP" },
  { key: "allNba", label: "All-NBA" },
  { key: "dpoy", label: "DPOY" },
  { key: "championships", label: "Titles" },
  { key: "finalsMvp", label: "Finals MVP" },
];

export function comparisonSections(
  playerA: ComparisonPlayer,
  playerB: ComparisonPlayer,
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
      playerA.regularSeason,
      playerB.regularSeason,
    ),
    statsSection("Playoffs", playerA.playoffs, playerB.playoffs),
  ];
}

function statsSection(
  label: "Regular Season" | "Playoffs",
  statsA: CareerStats,
  statsB: CareerStats,
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
