import { useRef } from "react";

import styles from "@/features/ranking/components/HelpDialog.module.css";
import { useDialogFocus } from "@/shared/hooks/useDialogFocus";

interface HelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: () => void;
  playerCount?: number;
}

const steps = [
  "Compare blind résumés",
  "Pick A, B, or tie",
  "Reveal your ranking",
] as const;

export function HelpDialog({
  isOpen,
  onClose,
  onStart,
  playerCount = 100,
}: HelpDialogProps): React.JSX.Element | null {
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
        aria-labelledby="help-title"
        aria-modal="true"
        className={styles.dialog}
        ref={dialogRef}
        role="dialog"
      >
        <header className={styles.header}>
          <h2 id="help-title">How it works</h2>
          <button
            aria-label="Close instructions"
            className={styles.close}
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            ×
          </button>
        </header>
        {steps.map((step, index) => (
          <div
            className={styles.step}
            key={step}
          >
            <span className={styles.number}>{index + 1}</span>
            <strong>{step}</strong>
          </div>
        ))}
        <footer className={styles.footer}>
          <span>{playerCount} players · Auto-saves</span>
          <button
            className={styles.start}
            onClick={onStart}
            type="button"
          >
            Start
          </button>
        </footer>
      </section>
    </div>
  );
}
