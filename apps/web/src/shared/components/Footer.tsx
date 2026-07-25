import styles from "@/shared/components/Footer.module.css";

interface FooterProps {
  onData: () => void;
  onHowItWorks: () => void;
  onPrivacy: () => void;
}

export function Footer({
  onData,
  onHowItWorks,
  onPrivacy,
}: FooterProps): React.JSX.Element {
  return (
    <footer
      className={styles.footer}
      data-testid="app-footer"
    >
      <span className={styles.copyright}>© 2026 AllTime25</span>
      <nav
        aria-label="Footer navigation"
        className={styles.links}
      >
        <button onClick={onHowItWorks} type="button">
          How it works
        </button>
        <span aria-hidden="true">·</span>
        <button onClick={onData} type="button">
          Data
        </button>
        <span aria-hidden="true">·</span>
        <button onClick={onPrivacy} type="button">
          Privacy
        </button>
      </nav>
      <span className={styles.disclaimer}>Not affiliated with the NBA</span>
    </footer>
  );
}
