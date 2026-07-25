import {
  useRef,
  useState,
} from "react";

import styles from "@/features/ranking/components/HelpDialog.module.css";
import { RankingModeSelector } from "@/features/ranking/components/RankingModeSelector";
import type { IdentityMode } from "@/features/ranking/domain/player";
import type { RankingSelection } from "@/features/ranking/domain/player";
import { DEFAULT_RANKING_SELECTION } from "@/features/ranking/model/rankingSelection";
import dialogStyles from "@/shared/components/Dialog.module.css";
import { useDialogFocus } from "@/shared/hooks/useDialogFocus";

interface BaseHelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface InstructionsHelpDialogProps extends BaseHelpDialogProps {
  identityMode?: IdentityMode;
  mode?: "help";
}

interface OnboardingHelpDialogProps extends BaseHelpDialogProps {
  isSubmitting?: boolean;
  mode: "onboarding";
  onStart: (selection: RankingSelection) => void | Promise<void>;
}

type HelpDialogProps =
  | InstructionsHelpDialogProps
  | OnboardingHelpDialogProps;

const ignoreClose = (): void => {};

export function HelpDialog(
  props: HelpDialogProps,
): React.JSX.Element | null {
  if (!props.isOpen) return null;
  return <OpenHelpDialog {...props} />;
}

function OpenHelpDialog(
  props: HelpDialogProps,
): React.JSX.Element {
  const isOnboarding = props.mode === "onboarding";
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useDialogFocus(
    true,
    isOnboarding ? ignoreClose : props.onClose,
    isOnboarding ? titleRef : closeButtonRef,
  );
  const [selection, setSelection] =
    useState<RankingSelection>(DEFAULT_RANKING_SELECTION);

  const identityMode = isOnboarding
    ? selection.identityMode
    : (props.identityMode ?? "normal");

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
        if (
          !isOnboarding &&
          event.currentTarget === event.target
        ) {
          props.onClose();
        }
      }}
      role="presentation"
    >
      <section
        aria-labelledby="help-title"
        aria-modal="true"
        className={`${dialogStyles.dialog} ${styles.dialog}`}
        ref={dialogRef}
        role="dialog"
      >
        <header className={dialogStyles.header}>
          <h2
            id="help-title"
            ref={titleRef}
            tabIndex={-1}
          >
            How it works
          </h2>
          {!isOnboarding ? (
            <button
              aria-label="Close instructions"
              className={dialogStyles.close}
              onClick={props.onClose}
              ref={closeButtonRef}
              type="button"
            >
              ×
            </button>
          ) : null}
        </header>
        <div className={styles.body}>
          <div>
            {steps.map((step, index) => (
              <div
                className={styles.step}
                key={step}
              >
                <span className={styles.number}>{index + 1}</span>
                <strong>{step}</strong>
              </div>
            ))}
          </div>
          {isOnboarding ? (
            <>
              <div className={styles.form}>
                <RankingModeSelector
                  namePrefix="onboarding"
                  onChange={setSelection}
                  selection={selection}
                />
              </div>
              <footer className={styles.footer}>
                <button
                  className={styles.start}
                  disabled={props.isSubmitting}
                  onClick={() => void props.onStart(selection)}
                  type="button"
                >
                  Start ranking
                </button>
              </footer>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
