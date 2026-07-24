import type { AnonymousPlayerResponse } from "@/features/ranking/api/rankingApi";
import styles from "@/features/ranking/components/CompactComparisonMatrix.module.css";
import type { ComparisonSection } from "@/features/ranking/model/comparisonRows";

interface CompactComparisonMatrixProps {
  playerA: AnonymousPlayerResponse;
  playerB: AnonymousPlayerResponse;
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
        <strong>
          {playerA.label} <span>{playerA.code}</span>
        </strong>
        <strong>
          {playerB.label} <span>{playerB.code}</span>
        </strong>
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
