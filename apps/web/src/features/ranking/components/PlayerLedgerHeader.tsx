import { PlayerPortrait } from "@/features/ranking/components/PlayerPortrait";
import styles from "@/features/ranking/components/PlayerLedgerHeader.module.css";
import type { ComparisonPlayer } from "@/features/ranking/session/sessionView";

interface PlayerLedgerHeaderProps {
  player: ComparisonPlayer;
}

export function PlayerLedgerHeader({
  player,
}: PlayerLedgerHeaderProps): React.JSX.Element {
  if ("name" in player) {
    return (
      <span className={`${styles.header} ${styles.identified}`}>
        <span className="sr-only">{player.label}</span>
        <PlayerPortrait
          className={styles.portrait}
          name={player.name}
          src={player.imageUrl}
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
