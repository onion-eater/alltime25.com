import { useState } from "react";

import type { RankingGroupResponse } from "@/features/ranking/api/rankingApi";
import styles from "@/features/ranking/components/RankingRow.module.css";

type RevealedPlayer = RankingGroupResponse["players"][number];
const FALLBACK_IMAGE = "/player-fallback.svg";

interface RankingRowProps {
  player: RevealedPlayer;
  rankLabel: string;
}

export function RankingRow({
  player,
  rankLabel,
}: RankingRowProps): React.JSX.Element {
  const [imageSource, setImageSource] = useState(player.image_url);

  return (
    <div className={styles.row}>
      <div className={styles.rank}>{rankLabel}</div>
      <div className={styles.photo}>
        <img
          alt={player.name}
          onError={() => setImageSource(FALLBACK_IMAGE)}
          src={imageSource}
        />
      </div>
      <div className={styles.identity}>
        <strong>{player.name}</strong>
        <span>{player.era}</span>
      </div>
    </div>
  );
}
