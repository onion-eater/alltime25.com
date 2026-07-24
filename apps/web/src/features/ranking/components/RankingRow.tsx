import type { RankingGroupResponse } from "@/features/ranking/api/rankingApi";
import { PlayerPortrait } from "@/features/ranking/components/PlayerPortrait";
import styles from "@/features/ranking/components/RankingRow.module.css";

type RevealedPlayer = RankingGroupResponse["players"][number];

interface RankingRowProps {
  player: RevealedPlayer;
  rankLabel: string;
}

export function RankingRow({
  player,
  rankLabel,
}: RankingRowProps): React.JSX.Element {
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
