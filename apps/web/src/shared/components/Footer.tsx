import styles from "@/shared/components/Footer.module.css";

export function Footer(): React.JSX.Element {
  return (
    <footer
      className={styles.footer}
      data-testid="app-footer"
    >
      <span>AllTime 25</span>
      <span>Development catalog · Data frozen 2024-06-18</span>
    </footer>
  );
}
