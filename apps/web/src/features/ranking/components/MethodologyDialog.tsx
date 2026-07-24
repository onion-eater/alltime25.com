import { useRef } from "react";

import styles from "@/features/ranking/components/HelpDialog.module.css";
import { useDialogFocus } from "@/shared/hooks/useDialogFocus";

interface MethodologyDialogProps {
  candidateCount?: number;
  isOpen: boolean;
  onClose: () => void;
}

const methodology = [
  "NBA/BAA career stats",
  "Regular season + playoffs",
  "Raw, not era-adjusted",
  "— means unavailable",
  "Ties share a rank",
  "Cutoff ties are included",
] as const;

export function MethodologyDialog({
  candidateCount = 50,
  isOpen,
  onClose,
}: MethodologyDialogProps): React.JSX.Element | null {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useDialogFocus(isOpen, onClose, closeButtonRef);

  if (!isOpen) return null;

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      role="presentation"
    >
      <section
        aria-labelledby="methodology-title"
        aria-modal="true"
        className={styles.dialog}
        ref={dialogRef}
        role="dialog"
      >
        <header className={styles.header}>
          <h2 id="methodology-title">Methodology</h2>
          <button
            aria-label="Close methodology"
            className={styles.close}
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            ×
          </button>
        </header>
        <ul className={styles.methodology}>
          <li>{candidateCount} candidates</li>
          {methodology.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
