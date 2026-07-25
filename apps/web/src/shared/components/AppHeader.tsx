import styles from "@/shared/components/AppHeader.module.css";

interface AppHeaderProps {
  onBrand: () => void;
  onHelp: () => void;
  onRestart: () => void;
  onRanking: () => void;
  onVote: (() => void) | null;
}

export function AppHeader({
  onBrand,
  onHelp,
  onRestart,
  onRanking,
  onVote,
}: AppHeaderProps): React.JSX.Element {
  return (
    <header
      className={styles.header}
      data-testid="app-header"
    >
      <div className={styles.inner}>
        <button
          aria-label="AllTime 25"
          className={styles.brand}
          onClick={onBrand}
          type="button"
        >
          <span className={styles.mark}>25</span>
          <span className={styles.name}>ALLTIME</span>
        </button>
        <nav
          aria-label="Main navigation"
          className={styles.navigation}
        >
          {onVote !== null ? (
            <button
              className={`${styles.navButton} ${styles.voteButton}`}
              onClick={onVote}
              type="button"
            >
              Vote
            </button>
          ) : null}
          <button
            className={`${styles.navButton} ${styles.restartButton}`}
            onClick={onRestart}
            type="button"
          >
            Restart
          </button>
          <button
            className={styles.navButton}
            onClick={onRanking}
            type="button"
          >
            Ranking
          </button>
          <button
            aria-label="How to play"
            className={styles.help}
            onClick={onHelp}
            type="button"
          >
            ?
          </button>
        </nav>
      </div>
    </header>
  );
}
