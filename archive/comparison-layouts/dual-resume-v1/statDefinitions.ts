import type {
  CareerStatsResponse,
  HonorsResponse,
} from "@/features/ranking/api/rankingApi";

export type CareerStatKey = Exclude<keyof CareerStatsResponse, "games">;
export type HonorKey = keyof HonorsResponse;

export const CAREER_STATS: readonly {
  key: CareerStatKey;
  label: string;
}[] = [
  { key: "ppg", label: "PTS" },
  { key: "rpg", label: "REB" },
  { key: "apg", label: "AST" },
  { key: "spg", label: "STL" },
  { key: "bpg", label: "BLK" },
  { key: "fg_pct", label: "FG%" },
  { key: "ft_pct", label: "FT%" },
];

export const HONORS: readonly {
  key: HonorKey;
  label: string;
}[] = [
  { key: "mvp", label: "MVP" },
  { key: "all_nba", label: "All-NBA" },
  { key: "dpoy", label: "DPOY" },
  { key: "championships", label: "Titles" },
  { key: "finals_mvp", label: "Finals MVP" },
];

export function formatCareerStat(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

