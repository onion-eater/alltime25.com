export type RankingPreset = "top_10" | "top_25" | "top_50";
export type IdentityMode = "normal" | "blind";

export interface RankingSelection {
  readonly preset: RankingPreset;
  readonly identityMode: IdentityMode;
}

export interface CareerStats {
  readonly games: number;
  readonly ppg: number | null;
  readonly rpg: number | null;
  readonly apg: number | null;
  readonly spg: number | null;
  readonly bpg: number | null;
  readonly fgPct: number | null;
  readonly threePct: number | null;
  readonly ftPct: number | null;
}

export interface Honors {
  readonly mvp: number;
  readonly allNba: number;
  readonly dpoy: number | null;
  readonly championships: number;
  readonly finalsMvp: number | null;
}

export interface PlayerResume {
  readonly id: string;
  readonly name: string;
  readonly era: string;
  readonly seasons: number;
  readonly regularSeason: CareerStats;
  readonly playoffs: CareerStats;
  readonly honors: Honors;
  readonly imagePath: string;
  readonly asOf: string;
  readonly sourceNote: string;
}

export const PRESET_SIZES: Readonly<
  Record<
    RankingPreset,
    { readonly poolSize: 25 | 50 | 100; readonly targetSize: 10 | 25 | 50 }
  >
> = {
  top_10: { poolSize: 25, targetSize: 10 },
  top_25: { poolSize: 50, targetSize: 25 },
  top_50: { poolSize: 100, targetSize: 50 },
};

export function isRankingPreset(value: unknown): value is RankingPreset {
  return value === "top_10" || value === "top_25" || value === "top_50";
}

export function isIdentityMode(value: unknown): value is IdentityMode {
  return value === "normal" || value === "blind";
}
