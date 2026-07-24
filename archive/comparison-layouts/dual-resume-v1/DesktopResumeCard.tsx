import type {
  AnonymousPlayerResponse,
  CareerStatsResponse,
} from "@/features/ranking/api/rankingApi";
import styles from "@/features/ranking/components/DesktopResumeCard.module.css";
import {
  CAREER_STATS,
  formatCareerStat,
  HONORS,
} from "@/features/ranking/model/statDefinitions";

interface DesktopResumeCardProps {
  alternate?: boolean;
  player: AnonymousPlayerResponse;
}

export function DesktopResumeCard({
  alternate = false,
  player,
}: DesktopResumeCardProps): React.JSX.Element {
  return (
    <article className={styles.card}>
      <header
        className={`${styles.header} ${alternate ? styles.alternate : ""}`}
      >
        <div>
          <div className={styles.label}>{player.label}</div>
          <div className={styles.code}>{player.code}</div>
        </div>
        <div className={styles.era}>
          <strong>{player.era}</strong>
          <span>Era</span>
        </div>
      </header>
      <div className={styles.context}>
        <ContextStat
          label="Seasons"
          value={player.seasons.toLocaleString()}
        />
        <ContextStat
          label="Reg. games"
          value={player.regular_season.games.toLocaleString()}
        />
        <ContextStat
          label="Playoff games"
          value={player.playoffs.games.toLocaleString()}
        />
      </div>
      <StatsSection
        label="Regular season"
        stats={player.regular_season}
      />
      <StatsSection
        label="Playoffs"
        stats={player.playoffs}
      />
      <div className={styles.sectionLabel}>Honors</div>
      <div className={styles.honors}>
        {HONORS.map(({ key, label }) => (
          <div
            className={styles.honor}
            key={key}
          >
            <strong>{player.honors[key]}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function ContextStat({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className={styles.contextItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatsSection({
  label,
  stats,
}: {
  label: string;
  stats: CareerStatsResponse;
}): React.JSX.Element {
  return (
    <>
      <div className={styles.sectionLabel}>
        {label}
        <span>per game</span>
      </div>
      <div className={styles.statGrid}>
        {CAREER_STATS.map(({ key, label: statLabel }) => (
          <div
            className={styles.stat}
            key={key}
          >
            <span>{statLabel}</span>
            <strong>{formatCareerStat(stats[key])}</strong>
          </div>
        ))}
      </div>
    </>
  );
}

