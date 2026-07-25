import wordmark from "@/assets/alltime25-wordmark.svg";
import styles from "@/shared/components/AppHeader.module.css";

interface AppHeaderProps {
  activeTab: "ranking" | "vote" | null;
  onBrand: () => void;
  onHelp: () => void;
  onRestart: () => void;
  onRanking: () => void;
  onVote: (() => void) | null;
}

export function AppHeader({
  activeTab,
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
          <img
            alt=""
            className={styles.wordmark}
            src={wordmark}
          />
        </button>
        <nav
          aria-label="Main navigation"
          className={styles.navigation}
        >
          {onVote !== null ? (
            <button
              aria-current={activeTab === "vote" ? "page" : undefined}
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
            aria-current={activeTab === "ranking" ? "page" : undefined}
            className={`${styles.navButton} ${styles.rankingButton}`}
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
