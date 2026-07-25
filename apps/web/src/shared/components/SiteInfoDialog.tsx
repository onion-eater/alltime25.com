import { useRef } from "react";

import dialogStyles from "@/shared/components/Dialog.module.css";
import styles from "@/shared/components/SiteInfoDialog.module.css";
import { useDialogFocus } from "@/shared/hooks/useDialogFocus";

export type SiteInfoTopic = "data" | "privacy";

interface SiteInfoDialogProps {
  onClose: () => void;
  topic: SiteInfoTopic | null;
}

const CONTENT: Record<
  SiteInfoTopic,
  { title: string; items: readonly string[] }
> = {
  data: {
    title: "Data",
    items: [
      "Career NBA/BAA statistics",
      "Regular season and playoffs",
      "Raw, not era-adjusted",
      "Frozen for consistent comparisons",
      "— means unavailable",
    ],
  },
  privacy: {
    title: "Privacy",
    items: [
      "Your ranking stays in this browser and is not uploaded.",
      "It is saved in localStorage so you can resume later.",
      "Clearing this site’s browser data deletes your ranking.",
      "Rankings do not sync between devices.",
    ],
  },
};

export function SiteInfoDialog({
  onClose,
  topic,
}: SiteInfoDialogProps): React.JSX.Element | null {
  if (topic === null) return null;
  return (
    <OpenSiteInfoDialog
      onClose={onClose}
      topic={topic}
    />
  );
}

function OpenSiteInfoDialog({
  onClose,
  topic,
}: {
  onClose: () => void;
  topic: SiteInfoTopic;
}): React.JSX.Element {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useDialogFocus(true, onClose, closeButtonRef);
  const content = CONTENT[topic];
  const titleId = `site-info-${topic}-title`;

  return (
    <div
      className={dialogStyles.backdrop}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      role="presentation"
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={dialogStyles.dialog}
        ref={dialogRef}
        role="dialog"
      >
        <header className={dialogStyles.header}>
          <h2 id={titleId}>{content.title}</h2>
          <button
            aria-label={`Close ${content.title}`}
            className={dialogStyles.close}
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            ×
          </button>
        </header>
        <div className={styles.body}>
          {content.items.map((item) => (
            <p
              className={styles.item}
              key={item}
            >
              {item}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
