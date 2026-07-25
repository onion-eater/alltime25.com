import type {
  IdentityMode,
  RankingPreset,
  RankingSelection,
} from "@/features/ranking/domain/player";
import styles from "@/features/ranking/components/RankingModeSelector.module.css";

interface RankingModeSelectorProps {
  namePrefix: string;
  onChange: (selection: RankingSelection) => void;
  selection: RankingSelection;
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

export function RankingModeSelector({
  namePrefix,
  onChange,
  selection,
}: RankingModeSelectorProps): React.JSX.Element {
  return (
    <>
      <ModeGroup
        legend="Ranking size"
        name={`${namePrefix}-ranking-preset`}
        onChange={(preset) => {
          onChange({ ...selection, preset });
        }}
        options={PRESETS}
        selected={selection.preset}
      />
      <ModeGroup
        legend="Players"
        name={`${namePrefix}-identity-mode`}
        onChange={(identityMode) => {
          onChange({ ...selection, identityMode });
        }}
        options={IDENTITIES}
        selected={selection.identityMode}
      />
    </>
  );
}

interface ModeGroupProps<Value extends string> {
  legend: string;
  name: string;
  onChange: (value: Value) => void;
  options: readonly { label: string; value: Value }[];
  selected: Value;
}

function ModeGroup<Value extends string>({
  legend,
  name,
  onChange,
  options,
  selected,
}: ModeGroupProps<Value>): React.JSX.Element {
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
