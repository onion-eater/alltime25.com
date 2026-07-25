import styles from "@/shared/components/Footer.module.css";

export function Footer(): React.JSX.Element {
  return (
    <footer
      className={styles.footer}
      data-testid="app-footer"
    >
      <span>AllTime 25</span>
      <span>NBA.com data · Frozen 2026-06-30</span>
    </footer>
  );
}
