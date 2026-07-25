import { Fragment } from "react";

import styles from "@/features/ranking/components/CenterComparisonLedger.module.css";
import { PlayerLedgerHeader } from "@/features/ranking/components/PlayerLedgerHeader";
import type { ComparisonSection } from "@/features/ranking/model/comparisonRows";
import type { ComparisonPlayer } from "@/features/ranking/session/sessionView";

interface CenterComparisonLedgerProps {
  playerA: ComparisonPlayer;
  playerB: ComparisonPlayer;
  sections: readonly ComparisonSection[];
}

export function CenterComparisonLedger({
  playerA,
  playerB,
  sections,
}: CenterComparisonLedgerProps): React.JSX.Element {
  const identified =
    "name" in playerA &&
    "name" in playerB;

  return (
    <div
      className={styles.wrap}
      data-testid="center-comparison-ledger"
    >
      <table
        className={styles.table}
        data-identity-mode={identified ? "normal" : "blind"}
      >
        <caption className="sr-only">
          {identified ? "NBA" : "Anonymous NBA"} career comparison.
          Player A values are left and Player B values are right.
        </caption>
        <colgroup>
          <col className={styles.playerColumn} />
          <col className={styles.labelColumn} />
          <col className={styles.playerColumn} />
        </colgroup>
        <thead>
          <tr>
            <th
              className={styles.playerHeader}
              data-testid="player-a-header"
              scope="col"
            >
              <PlayerLedgerHeader player={playerA} />
            </th>
            <th
              aria-label="Statistic"
              className={styles.centerHeader}
              data-testid="stat-header"
              scope="col"
            >
              Stat
            </th>
            <th
              className={styles.playerHeader}
              data-testid="player-b-header"
              scope="col"
            >
              <PlayerLedgerHeader player={playerB} />
            </th>
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <Fragment key={section.label}>
              <tr className={styles.sectionRow}>
                <th
                  colSpan={3}
                  scope="colgroup"
                >
                  {section.label}
                </th>
              </tr>
              {section.rows.map((row) => (
                <tr
                  className={styles.statRow}
                  key={`${section.label}-${row.label}`}
                >
                  <td className={styles.value}>{row.valueA}</td>
                  <th
                    className={styles.label}
                    scope="row"
                  >
                    {row.label}
                  </th>
                  <td className={styles.value}>{row.valueB}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
