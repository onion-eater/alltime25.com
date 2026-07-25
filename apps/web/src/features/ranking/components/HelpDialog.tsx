import { useRef } from "react";

import type { IdentityMode } from "@/features/ranking/api/rankingApi";
import styles from "@/features/ranking/components/HelpDialog.module.css";
import dialogStyles from "@/shared/components/Dialog.module.css";
import { useDialogFocus } from "@/shared/hooks/useDialogFocus";

interface HelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
  identityMode?: IdentityMode;
}

export function HelpDialog({
  identityMode = "normal",
  isOpen,
  onClose,
}: HelpDialogProps): React.JSX.Element | null {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useDialogFocus(isOpen, onClose, closeButtonRef);

  if (!isOpen) return null;

  const steps = [
    identityMode === "blind"
      ? "Compare blind résumés"
      : "Compare player résumés",
    "Pick A, B, or tie",
    "Reveal your ranking",
  ] as const;

  return (
    <div
      className={dialogStyles.backdrop}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      role="presentation"
    >
      <section
        aria-labelledby="help-title"
        aria-modal="true"
        className={dialogStyles.dialog}
        ref={dialogRef}
        role="dialog"
      >
        <header className={dialogStyles.header}>
          <h2 id="help-title">How it works</h2>
          <button
            aria-label="Close instructions"
            className={dialogStyles.close}
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
      </section>
    </div>
  );
}
