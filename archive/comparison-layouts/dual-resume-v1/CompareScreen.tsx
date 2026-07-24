import type {
  SessionResponse,
  VoteOutcome,
} from "@/features/ranking/api/rankingApi";
import styles from "@/features/ranking/components/CompareScreen.module.css";
import { DesktopResumeCard } from "@/features/ranking/components/DesktopResumeCard";
import { MobileComparisonTable } from "@/features/ranking/components/MobileComparisonTable";
import { ArrowIcon } from "@/shared/components/ArrowIcon";

interface CompareScreenProps {
  session: SessionResponse;
  isSubmitting: boolean;
  onShowProgress?: () => void;
  onUndo: () => void | Promise<void>;
  onVote: (outcome: VoteOutcome) => void | Promise<void>;
}

export function CompareScreen({
  session,
  isSubmitting,
  onShowProgress,
  onUndo,
  onVote,
}: CompareScreenProps): React.JSX.Element | null {
  const comparison = session.comparison;
  if (comparison === null) return null;

  const progressPercent =
    (session.progress.processed / session.progress.total) * 100;

  return (
    <section className={styles.screen}>
      <div className={`page-shell ${styles.layout}`}>
        <header className={styles.gameHead}>
          <h1 className={styles.title}>Who had the greater career?</h1>
          <button
            aria-label="Show progress"
            className={styles.progressButton}
            onClick={onShowProgress}
            type="button"
          >
            <span className={styles.progressLabel}>
              <span>Progress</span>
              <span>
                {session.progress.processed} / {session.progress.total}
              </span>
            </span>
            <span className={styles.progressTrack}>
              <span
                className={styles.progressFill}
                style={{ width: `${progressPercent}%` }}
              />
            </span>
          </button>
        </header>

        <div className={styles.desktopComparison}>
          <DesktopResumeCard player={comparison.player_a} />
          <div
            aria-hidden="true"
            className={styles.versus}
          >
            <span>VS</span>
          </div>
          <DesktopResumeCard
            alternate
            player={comparison.player_b}
          />
        </div>

        <MobileComparisonTable
          playerA={comparison.player_a}
          playerB={comparison.player_b}
        />

        <div className={styles.voteBar}>
          <button
            className={`${styles.vote} ${styles.primaryVote}`}
            disabled={isSubmitting}
            onClick={() => void onVote("better")}
            type="button"
          >
            Player A
          </button>
          <button
            className={`${styles.vote} ${styles.tieVote}`}
            disabled={isSubmitting}
            onClick={() => void onVote("tie")}
            type="button"
          >
            Tie
          </button>
          <button
            className={`${styles.vote} ${styles.primaryVote}`}
            disabled={isSubmitting}
            onClick={() => void onVote("worse")}
            type="button"
          >
            Player B
          </button>
        </div>

        <div className={styles.tools}>
          <button
            className={styles.undo}
            disabled={isSubmitting || session.progress.votes === 0}
            onClick={() => void onUndo()}
            type="button"
          >
            <ArrowIcon direction="left" />
            Undo
          </button>
          <span>{isSubmitting ? "Saving" : "Saved"}</span>
        </div>
      </div>
    </section>
  );
}
