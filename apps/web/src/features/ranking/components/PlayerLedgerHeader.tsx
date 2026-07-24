import type { AnonymousPlayerResponse } from "@/features/ranking/api/rankingApi";
import { PlayerPortrait } from "@/features/ranking/components/PlayerPortrait";
import styles from "@/features/ranking/components/PlayerLedgerHeader.module.css";

interface PlayerLedgerHeaderProps {
  player: AnonymousPlayerResponse;
}

export function PlayerLedgerHeader({
  player,
}: PlayerLedgerHeaderProps): React.JSX.Element {
  if ("name" in player && "image_url" in player) {
    return (
      <span className={`${styles.header} ${styles.identified}`}>
        <span className="sr-only">{player.label}</span>
        <PlayerPortrait
          className={styles.portrait}
          name={player.name}
          src={player.image_url}
        />
        <strong className={styles.playerName}>{player.name}</strong>
      </span>
    );
  }

  return (
    <span className={styles.header}>
      <strong>{player.label}</strong>
      <span>{player.code}</span>
    </span>
  );
}
