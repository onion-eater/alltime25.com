import {
  useRef,
  useState,
} from "react";

import type {
  IdentityMode,
  RankingPreset,
  RankingSelection,
} from "@/features/ranking/api/rankingApi";
import dialogStyles from "@/features/ranking/components/HelpDialog.module.css";
import styles from "@/features/ranking/components/ModesDialog.module.css";
import { useDialogFocus } from "@/shared/hooks/useDialogFocus";

interface ModesDialogProps {
  currentSelection: RankingSelection;
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onStart: (selection: RankingSelection) => void | Promise<void>;
}

const PRESETS: readonly {
  label: string;
  value: RankingPreset;
}[] = [
  { label: "Top 10", value: "top_10" },
  { label: "Top 25", value: "top_25" },
  { label: "Top 50", value: "top_50" },
];

const IDENTITIES: readonly {
  label: string;
  value: IdentityMode;
}[] = [
  { label: "Normal", value: "normal" },
  { label: "Blind", value: "blind" },
];

export function ModesDialog({
  currentSelection,
  isOpen,
  ...props
}: ModesDialogProps): React.JSX.Element | null {
  if (!isOpen) return null;
  return (
    <OpenModesDialog
      currentSelection={currentSelection}
      key={`${currentSelection.preset}-${currentSelection.identityMode}`}
      {...props}
    />
  );
}

type OpenModesDialogProps = Omit<ModesDialogProps, "isOpen">;

function OpenModesDialog({
  currentSelection,
  isSubmitting,
  onClose,
  onStart,
}: OpenModesDialogProps): React.JSX.Element {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useDialogFocus(true, onClose, closeButtonRef);
  const [selection, setSelection] =
    useState<RankingSelection>(currentSelection);

  const unchanged =
    selection.preset === currentSelection.preset &&
    selection.identityMode === currentSelection.identityMode;

  return (
    <div
      className={dialogStyles.backdrop}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      role="presentation"
    >
      <section
        aria-labelledby="modes-title"
        aria-modal="true"
        className={`${dialogStyles.dialog} ${styles.dialog}`}
        ref={dialogRef}
        role="dialog"
      >
        <header className={dialogStyles.header}>
          <h2 id="modes-title">Modes</h2>
          <button
            aria-label="Close modes"
            className={dialogStyles.close}
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            ×
          </button>
        </header>
        <div className={styles.form}>
          <ModeGroup
            legend="Ranking size"
            name="ranking-preset"
            onChange={(preset) => {
              setSelection((current) => ({
                ...current,
                preset: preset as RankingPreset,
              }));
            }}
            options={PRESETS}
            selected={selection.preset}
          />
          <ModeGroup
            legend="Players"
            name="identity-mode"
            onChange={(identityMode) => {
              setSelection((current) => ({
                ...current,
                identityMode: identityMode as IdentityMode,
              }));
            }}
            options={IDENTITIES}
            selected={selection.identityMode}
          />
        </div>
        <footer className={styles.footer}>
          <button
            className={styles.start}
            disabled={isSubmitting || unchanged}
            onClick={() => void onStart(selection)}
            type="button"
          >
            Start new ranking
          </button>
        </footer>
      </section>
    </div>
  );
}

interface ModeGroupProps {
  legend: string;
  name: string;
  onChange: (value: string) => void;
  options: readonly { label: string; value: string }[];
  selected: string;
}

function ModeGroup({
  legend,
  name,
  onChange,
  options,
  selected,
}: ModeGroupProps): React.JSX.Element {
  return (
    <fieldset className={styles.group}>
      <legend>{legend}</legend>
      <div
        className={styles.options}
        style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
      >
        {options.map((option) => (
          <label
            className={styles.option}
            key={option.value}
          >
            <input
              checked={selected === option.value}
              name={name}
              onChange={() => onChange(option.value)}
              type="radio"
              value={option.value}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
