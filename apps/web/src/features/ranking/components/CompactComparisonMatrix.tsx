import styles from "@/features/ranking/components/CompactComparisonMatrix.module.css";
import { PlayerPortrait } from "@/features/ranking/components/PlayerPortrait";
import type { ComparisonSection } from "@/features/ranking/model/comparisonRows";
import type { ComparisonPlayer } from "@/features/ranking/session/sessionView";

interface CompactComparisonMatrixProps {
  playerA: ComparisonPlayer;
  playerB: ComparisonPlayer;
  sections: readonly ComparisonSection[];
}

export function CompactComparisonMatrix({
  playerA,
  playerB,
  sections,
}: CompactComparisonMatrixProps): React.JSX.Element {
  return (
    <div
      className={styles.matrix}
      data-testid="compact-comparison-matrix"
    >
      <header className={styles.players}>
        <CompactPlayer player={playerA} />
        <CompactPlayer player={playerB} />
      </header>
      <div className={styles.sections}>
        {sections.map((section) => (
          <table key={section.label}>
            <caption>{section.label}</caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">{playerA.label}</th>
                <th scope="col">Statistic</th>
                <th scope="col">{playerB.label}</th>
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row) => (
                <tr key={row.label}>
                  <td>{row.valueA}</td>
                  <th scope="row">{row.label}</th>
                  <td>{row.valueB}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  );
}

function CompactPlayer({
  player,
}: {
  player: ComparisonPlayer;
}): React.JSX.Element {
  if ("name" in player) {
    return (
      <strong className={styles.identifiedPlayer}>
        <span className="sr-only">{player.label}</span>
        <PlayerPortrait
          className={styles.portrait}
          name={player.name}
          src={player.imageUrl}
        />
        <span>{abbreviateName(player.name)}</span>
      </strong>
    );
  }
  return (
    <strong>
      {player.label} <span>{player.code}</span>
    </strong>
  );
}

function abbreviateName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.at(-1)}`;
}
