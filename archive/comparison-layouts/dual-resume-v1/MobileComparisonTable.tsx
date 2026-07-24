import type {
  AnonymousPlayerResponse,
  CareerStatsResponse,
} from "@/features/ranking/api/rankingApi";
import styles from "@/features/ranking/components/MobileComparisonTable.module.css";
import {
  CAREER_STATS,
  formatCareerStat,
  HONORS,
} from "@/features/ranking/model/statDefinitions";

interface MobileComparisonTableProps {
  playerA: AnonymousPlayerResponse;
  playerB: AnonymousPlayerResponse;
}

export function MobileComparisonTable({
  playerA,
  playerB,
}: MobileComparisonTableProps): React.JSX.Element {
  return (
    <section
      aria-label="Player A and Player B career comparison"
      className={styles.table}
    >
      <header className={styles.players}>
        <MobilePlayer player={playerA} />
        <MobilePlayer player={playerB} />
      </header>
      <ComparisonSection
        className={styles.context}
        label="Career"
        metrics={[
          {
            label: "Seasons",
            valueA: playerA.seasons.toLocaleString(),
            valueB: playerB.seasons.toLocaleString(),
          },
          {
            label: "Reg. games",
            valueA: playerA.regular_season.games.toLocaleString(),
            valueB: playerB.regular_season.games.toLocaleString(),
          },
          {
            label: "Playoff games",
            valueA: playerA.playoffs.games.toLocaleString(),
            valueB: playerB.playoffs.games.toLocaleString(),
          },
        ]}
      />
      <StatsComparison
        label="Regular season"
        playerA={playerA.regular_season}
        playerB={playerB.regular_season}
      />
      <StatsComparison
        label="Playoffs"
        playerA={playerA.playoffs}
        playerB={playerB.playoffs}
      />
      <ComparisonSection
        className={styles.awards}
        label="Honors"
        metrics={HONORS.map(({ key, label }) => ({
          label,
          valueA: String(playerA.honors[key]),
          valueB: String(playerB.honors[key]),
        }))}
      />
    </section>
  );
}

function MobilePlayer({
  player,
}: {
  player: AnonymousPlayerResponse;
}): React.JSX.Element {
  return (
    <div className={styles.player}>
      <div>
        <strong>{player.label}</strong>
        <small>{player.code}</small>
      </div>
      <em>{player.era}</em>
    </div>
  );
}

function StatsComparison({
  label,
  playerA,
  playerB,
}: {
  label: string;
  playerA: CareerStatsResponse;
  playerB: CareerStatsResponse;
}): React.JSX.Element {
  return (
    <ComparisonSection
      className={styles.boxScore}
      label={label}
      metrics={CAREER_STATS.map(({ key, label: statLabel }) => ({
        label: statLabel,
        valueA: formatCareerStat(playerA[key]),
        valueB: formatCareerStat(playerB[key]),
      }))}
      note="per game"
    />
  );
}

function ComparisonSection({
  className,
  label,
  metrics,
  note,
}: {
  className: string;
  label: string;
  metrics: readonly {
    label: string;
    valueA: string;
    valueB: string;
  }[];
  note?: string;
}): React.JSX.Element {
  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>
        {label}
        {note ? <span>{note}</span> : null}
      </div>
      <div className={`${styles.metrics} ${className}`}>
        {metrics.map((metric) => (
          <div
            className={styles.metric}
            key={metric.label}
          >
            <span>{metric.label}</span>
            <div className={styles.pair}>
              <strong>{metric.valueA}</strong>
              <strong>{metric.valueB}</strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

