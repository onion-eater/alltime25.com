import {
  useRef,
  useState,
} from "react";

import { RankingModeSelector } from "@/features/ranking/components/RankingModeSelector";
import type { RankingSelection } from "@/features/ranking/domain/player";
import styles from "@/features/ranking/components/RestartDialog.module.css";
import { DEFAULT_RANKING_SELECTION } from "@/features/ranking/model/rankingSelection";
import dialogStyles from "@/shared/components/Dialog.module.css";
import { useDialogFocus } from "@/shared/hooks/useDialogFocus";

interface RestartDialogProps {
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onStart: (selection: RankingSelection) => void | Promise<void>;
}

export function RestartDialog({
  isOpen,
  ...props
}: RestartDialogProps): React.JSX.Element | null {
  if (!isOpen) return null;
  return <OpenRestartDialog {...props} />;
}

type OpenRestartDialogProps = Omit<RestartDialogProps, "isOpen">;

function OpenRestartDialog({
  isSubmitting,
  onClose,
  onStart,
}: OpenRestartDialogProps): React.JSX.Element {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useDialogFocus(true, onClose, closeButtonRef);
  const [selection, setSelection] =
    useState<RankingSelection>(DEFAULT_RANKING_SELECTION);

  return (
    <div
      className={dialogStyles.backdrop}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      role="presentation"
    >
      <section
        aria-labelledby="restart-title"
        aria-modal="true"
        className={`${dialogStyles.dialog} ${styles.dialog}`}
        ref={dialogRef}
        role="dialog"
      >
        <header className={dialogStyles.header}>
          <h2 id="restart-title">Restart</h2>
          <button
            aria-label="Close restart"
            className={dialogStyles.close}
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            ×
          </button>
        </header>
        <div className={styles.form}>
          <RankingModeSelector
            namePrefix="restart"
            onChange={setSelection}
            selection={selection}
          />
        </div>
        <footer className={styles.footer}>
          <button
            className={styles.start}
            disabled={isSubmitting}
            onClick={() => void onStart(selection)}
            type="button"
          >
            Restart ranking
          </button>
        </footer>
      </section>
    </div>
  );
}
