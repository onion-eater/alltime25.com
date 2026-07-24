import styles from "@/shared/components/AppHeader.module.css";

interface AppHeaderProps {
  onBrand: () => void;
  onHelp: () => void;
  onMethodology: () => void;
  onRanking: () => void;
}

export function AppHeader({
  onBrand,
  onHelp,
  onMethodology,
  onRanking,
}: AppHeaderProps): React.JSX.Element {
  return (
    <header
      className={styles.header}
      data-testid="app-header"
    >
      <div className={styles.inner}>
        <button
          aria-label="Blind 50"
          className={styles.brand}
          onClick={onBrand}
          type="button"
        >
          <span className={styles.mark}>50</span>
          <span className={styles.name}>BLIND 50</span>
        </button>
        <nav
          aria-label="Main navigation"
          className={styles.navigation}
        >
          <button
            className={styles.navButton}
            onClick={onRanking}
            type="button"
          >
            Ranking
          </button>
          <button
            className={styles.navButton}
            onClick={onMethodology}
            type="button"
          >
            Methodology
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
