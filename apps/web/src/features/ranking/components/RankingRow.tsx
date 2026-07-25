import type {
  ActiveRankedPlayer,
  RevealedRankedPlayer,
} from "@/features/ranking/session/sessionView";
import { PlayerPortrait } from "@/features/ranking/components/PlayerPortrait";
import styles from "@/features/ranking/components/RankingRow.module.css";

type RankedPlayer = RevealedRankedPlayer | ActiveRankedPlayer;

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
          src={player.imageUrl}
        />
      </div>
      <div className={styles.identity}>
        <strong>{player.name}</strong>
        <span>{player.era}</span>
      </div>
    </div>
  );
}
