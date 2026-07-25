import type {
  ActiveRankingGroupResponse,
  RankingGroupResponse,
} from "@/features/ranking/api/rankingApi";
import { PlayerPortrait } from "@/features/ranking/components/PlayerPortrait";
import styles from "@/features/ranking/components/RankingRow.module.css";

type RankedPlayer =
  | RankingGroupResponse["players"][number]
  | ActiveRankingGroupResponse["players"][number];

interface RankingRowProps {
  player: RankedPlayer;
  rankLabel: string;
}

export function RankingRow({
  player,
  rankLabel,
}: RankingRowProps): React.JSX.Element {
  if (!("name" in player)) {
    return (
      <div className={`${styles.row} ${styles.anonymousRow}`}>
        <div className={styles.rank}>{rankLabel}</div>
        <div className={styles.identity}>
          <strong>{player.code}</strong>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.row}>
      <div className={styles.rank}>{rankLabel}</div>
      <div className={styles.photo}>
        <PlayerPortrait
          name={player.name}
          src={player.image_url}
        />
      </div>
      <div className={styles.identity}>
        <strong>{player.name}</strong>
        <span>{player.era}</span>
      </div>
    </div>
  );
}
