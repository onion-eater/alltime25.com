import type { SessionResponse } from "@/features/ranking/api/rankingApi";
import styles from "@/features/ranking/components/ProgressScreen.module.css";
import { ArrowIcon } from "@/shared/components/ArrowIcon";

interface ProgressScreenProps {
  error?: string | null;
  isLoading?: boolean;
  onResume: () => void;
  onRetry?: () => void;
  session: SessionResponse | null;
}

export function ProgressScreen({
  error = null,
  isLoading = false,
  onResume,
  onRetry,
  session,
}: ProgressScreenProps): React.JSX.Element {
  const processed = session?.progress.processed ?? 0;
  const total = session?.progress.total ?? 0;
  const percent = total === 0 ? 0 : (processed / total) * 100;

  return (
    <section className={styles.screen}>
      <div className={`page-shell ${styles.layout}`}>
        <article className={styles.card}>
          <header className={styles.header}>
            <p>Progress</p>
            <h1>
              {processed} / {total || "—"}
            </h1>
          </header>
          <div className={styles.track}>
            {percent > 0 ? (
              <span
                className={styles.fill}
                style={{ width: `${percent}%` }}
              />
            ) : null}
          </div>
          <div className={styles.metrics}>
            <Metric
              label="Votes"
              value={session?.progress.votes ?? 0}
            />
            <Metric
              label="Ties"
              value={session?.progress.ties ?? 0}
            />
            <Metric
              label="Ranked"
              value={processed}
            />
          </div>
          <footer className={styles.footer}>
            <p className={error ? styles.error : undefined}>
              {error ?? (isLoading ? "Loading ranking…" : "Ranking hidden until reveal.")}
            </p>
            {!isLoading && error !== null && onRetry ? (
              <button
                className={styles.resume}
                onClick={onRetry}
                type="button"
              >
                Retry
                <ArrowIcon />
              </button>
            ) : !isLoading && session !== null ? (
              <button
                className={styles.resume}
                onClick={onResume}
                type="button"
              >
                Resume
                <ArrowIcon />
              </button>
            ) : null}
          </footer>
        </article>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}): React.JSX.Element {
  return (
    <div className={styles.metric}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
