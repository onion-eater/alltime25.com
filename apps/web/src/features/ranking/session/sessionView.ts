import type { PlayerCatalog } from "@/features/ranking/catalog/catalogRepository";
import {
  type CareerStats,
  type Honors,
  type IdentityMode,
  type RankingPreset,
} from "@/features/ranking/domain/player";
import {
  currentComparison,
  isRankingComplete,
  processedPlayerCount,
  visibleRankGroups,
  type VoteOutcome,
} from "@/features/ranking/domain/ranking";
import type { PersistedRankingSessionV1 } from "@/features/ranking/persistence/persistedSession";
import {
  rankingStateFor,
  validateSessionCatalog,
} from "@/features/ranking/session/rankingSession";

export type { VoteOutcome };

export interface AnonymousComparisonPlayer {
  readonly label: "Player A" | "Player B";
  readonly code: string;
  readonly era: string;
  readonly seasons: number;
  readonly regularSeason: CareerStats;
  readonly playoffs: CareerStats;
  readonly honors: Honors;
}

export interface IdentifiedComparisonPlayer
  extends AnonymousComparisonPlayer {
  readonly name: string;
  readonly imageUrl: string;
}

export type ComparisonPlayer =
  | AnonymousComparisonPlayer
  | IdentifiedComparisonPlayer;

export interface ComparisonView {
  readonly playerA: ComparisonPlayer;
  readonly playerB: ComparisonPlayer;
}

export interface AnonymousRankedPlayer {
  readonly code: string;
}

export interface IdentifiedRankedPlayer extends AnonymousRankedPlayer {
  readonly name: string;
  readonly era: string;
  readonly imageUrl: string;
}

export type ActiveRankedPlayer =
  | AnonymousRankedPlayer
  | IdentifiedRankedPlayer;

export interface RevealedRankedPlayer {
  readonly name: string;
  readonly era: string;
  readonly imageUrl: string;
}

export interface ActiveRankingGroup {
  readonly rank: number;
  readonly players: readonly ActiveRankedPlayer[];
}

export interface RevealedRankingGroup {
  readonly rank: number;
  readonly players: readonly RevealedRankedPlayer[];
}

export interface RankingProgress {
  readonly processed: number;
  readonly total: number;
  readonly votes: number;
  readonly ties: number;
  readonly eliminated: number;
}

export interface RankingSessionView {
  readonly id: string;
  readonly catalogId: string;
  readonly preset: RankingPreset;
  readonly identityMode: IdentityMode;
  readonly poolSize: number;
  readonly targetSize: number;
  readonly revision: number;
  readonly status: "active" | "complete";
  readonly canUndo: boolean;
  readonly progress: RankingProgress;
  readonly comparison: ComparisonView | null;
  readonly rankingPreview: readonly ActiveRankingGroup[] | null;
  readonly ranking: readonly RevealedRankingGroup[] | null;
}

export function buildRankingSessionView(
  session: PersistedRankingSessionV1,
  catalog: PlayerCatalog,
): RankingSessionView {
  validateSessionCatalog(session, catalog);
  const state = rankingStateFor(session);
  const complete = isRankingComplete(state);
  const codeByPlayerId = new Map(
    session.playerOrder.map((playerId, index) => [
      playerId,
      `#${String(index + 1).padStart(3, "0")}`,
    ]),
  );
  const comparison = currentComparison(state);

  return {
    id: session.id,
    catalogId: session.catalogId,
    preset: session.preset,
    identityMode: session.identityMode,
    poolSize: state.poolSize,
    targetSize: state.targetSize,
    revision: session.revision,
    status: complete ? "complete" : "active",
    canUndo: session.outcomes.length > 0,
    progress: {
      processed: processedPlayerCount(state),
      total: state.poolSize,
      votes: state.votesCount,
      ties: state.tiesCount,
      eliminated: state.eliminatedCount,
    },
    comparison:
      comparison === null
        ? null
        : {
            playerA: comparisonPlayer(
              comparison.candidateId,
              "Player A",
              session.identityMode,
              catalog,
              codeByPlayerId,
            ),
            playerB: comparisonPlayer(
              comparison.opponentId,
              "Player B",
              session.identityMode,
              catalog,
              codeByPlayerId,
            ),
          },
    rankingPreview: complete
      ? null
      : rankGroups(
          visibleRankGroups(state).map((group) => group.playerIds),
          (playerId) =>
            activeRankedPlayer(
              playerId,
              session.identityMode,
              catalog,
              codeByPlayerId,
            ),
        ),
    ranking: complete
      ? rankGroups(
          state.groups.map((group) => group.playerIds),
          (playerId) => {
            const player = requiredPlayer(catalog, playerId);
            return {
              name: player.name,
              era: player.era,
              imageUrl: player.imagePath,
            };
          },
        )
      : null,
  };
}

function comparisonPlayer(
  playerId: string,
  label: "Player A" | "Player B",
  identityMode: IdentityMode,
  catalog: PlayerCatalog,
  codeByPlayerId: ReadonlyMap<string, string>,
): ComparisonPlayer {
  const player = requiredPlayer(catalog, playerId);
  const anonymous: AnonymousComparisonPlayer = {
    label,
    code: requiredCode(codeByPlayerId, playerId),
    era: player.era,
    seasons: player.seasons,
    regularSeason: player.regularSeason,
    playoffs: player.playoffs,
    honors: player.honors,
  };
  if (identityMode === "blind") return anonymous;
  return {
    ...anonymous,
    name: player.name,
    imageUrl: player.imagePath,
  };
}

function activeRankedPlayer(
  playerId: string,
  identityMode: IdentityMode,
  catalog: PlayerCatalog,
  codeByPlayerId: ReadonlyMap<string, string>,
): ActiveRankedPlayer {
  const code = requiredCode(codeByPlayerId, playerId);
  if (identityMode === "blind") return { code };
  const player = requiredPlayer(catalog, playerId);
  return {
    code,
    name: player.name,
    era: player.era,
    imageUrl: player.imagePath,
  };
}

function rankGroups<Player>(
  groups: readonly (readonly string[])[],
  playerFor: (playerId: string) => Player,
): readonly { readonly rank: number; readonly players: readonly Player[] }[] {
  let nextRank = 1;
  return groups.map((playerIds) => {
    const group = {
      rank: nextRank,
      players: playerIds.map(playerFor),
    };
    nextRank += playerIds.length;
    return group;
  });
}

function requiredPlayer(
  catalog: PlayerCatalog,
  playerId: string,
) {
  const player = catalog.playersById.get(playerId);
  if (player === undefined) {
    throw new Error("Ranking references an unknown player.");
  }
  return player;
}

function requiredCode(
  codeByPlayerId: ReadonlyMap<string, string>,
  playerId: string,
): string {
  const code = codeByPlayerId.get(playerId);
  if (code === undefined) {
    throw new Error("Ranking references a player without a session code.");
  }
  return code;
}
