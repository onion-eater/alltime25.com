import type { AnonymousPlayerResponse } from "@/features/ranking/api/rankingApi";
import styles from "@/features/ranking/components/PlayerLedgerHeader.module.css";

interface PlayerLedgerHeaderProps {
  player: AnonymousPlayerResponse;
}

export function PlayerLedgerHeader({
  player,
}: PlayerLedgerHeaderProps): React.JSX.Element {
  return (
    <span className={styles.header}>
      <strong>{player.label}</strong>
      <span>{player.code}</span>
    </span>
  );
}
