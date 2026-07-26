import type { MouseEvent } from "react";

import styles from "@/shared/components/Footer.module.css";

interface FooterProps {
  onData: () => void;
  onPrivacy: () => void;
}

export function Footer({
  onData,
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
        <a
          aria-haspopup="dialog"
          href="/data/"
          onClick={(event) => openDialog(event, onData)}
        >
          Data
        </a>
        <span aria-hidden="true">·</span>
        <a
          aria-haspopup="dialog"
          href="/privacy/"
          onClick={(event) => openDialog(event, onPrivacy)}
        >
          Privacy
        </a>
      </nav>
      <span className={styles.disclaimer}>Not affiliated with the NBA</span>
    </footer>
  );
}

function openDialog(
  event: MouseEvent<HTMLAnchorElement>,
  open: () => void,
): void {
  if (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }
  event.preventDefault();
  open();
}
