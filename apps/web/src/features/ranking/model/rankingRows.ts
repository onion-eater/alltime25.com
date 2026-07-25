import type {
  ActiveRankingGroupResponse,
  RankingGroupResponse,
} from "@/features/ranking/api/rankingApi";

type RevealedPlayer = RankingGroupResponse["players"][number];
type ActiveRankingPlayer = ActiveRankingGroupResponse["players"][number];

export interface DisplayRow<Player = RevealedPlayer> {
  isTied: boolean;
  player: Player;
  rank: number;
}

export interface ShareRow extends DisplayRow {
  rankLabel: string;
  showPortrait: boolean;
}

export function flattenRanking(
  groups: readonly RankingGroupResponse[],
): DisplayRow[] {
  return flattenGroups(groups);
}

export function flattenActiveRanking(
  groups: readonly ActiveRankingGroupResponse[],
): DisplayRow<ActiveRankingPlayer>[] {
  return flattenGroups(groups);
}

function flattenGroups<Player>(
  groups: readonly {
    players: readonly Player[];
    rank: number;
  }[],
): DisplayRow<Player>[] {
  return groups.flatMap((group) =>
    group.players.map((player) => ({
      isTied: group.players.length > 1,
      player,
      rank: group.rank,
    })),
  );
}

export function rowsForShare(
  rows: readonly DisplayRow[],
  targetSize: number,
): ShareRow[] {
  if (![10, 25, 50].includes(targetSize)) {
    throw new Error("Unsupported ranking size.");
  }
  const selected = rows.slice(0, targetSize);
  if (selected.length !== targetSize) {
    throw new Error("The completed ranking has too few players.");
  }
  return selected.map((row) => ({
    ...row,
    rankLabel: row.isTied ? `T-${row.rank}` : String(row.rank),
    showPortrait: targetSize !== 50,
  }));
}
