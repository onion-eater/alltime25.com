import type {
  SessionResponse,
  VoteOutcome,
} from "@/features/ranking/api/rankingApi";
import { CenterComparisonLedger } from "@/features/ranking/components/CenterComparisonLedger";
import { CompactComparisonMatrix } from "@/features/ranking/components/CompactComparisonMatrix";
import styles from "@/features/ranking/components/CompareScreen.module.css";
import { comparisonSections } from "@/features/ranking/model/comparisonRows";
import { ArrowIcon } from "@/shared/components/ArrowIcon";

interface CompareScreenProps {
  session: SessionResponse;
  isSubmitting: boolean;
  statusMessage?: string;
  onShowProgress?: () => void;
  onUndo: () => void | Promise<void>;
  onVote: (outcome: VoteOutcome) => void | Promise<void>;
}

export function CompareScreen({
  session,
  isSubmitting,
  statusMessage,
  onShowProgress,
  onUndo,
  onVote,
}: CompareScreenProps): React.JSX.Element | null {
  const comparison = session.comparison;
  if (comparison === null) return null;

  const progressPercent =
    (session.progress.processed / session.progress.total) * 100;
  const sections = comparisonSections(
    comparison.player_a,
    comparison.player_b,
  );

  return (
    <section className={styles.screen}>
      <div className={`page-shell ${styles.layout}`}>
        <header
          className={styles.gameHead}
          data-testid="comparison-heading"
        >
          <h1 className={styles.title}>Greater career?</h1>
          <button
            aria-label="Show progress"
            className={styles.progressButton}
            onClick={onShowProgress}
            type="button"
          >
            <span className={styles.progressLabel}>
              <span>
                {session.progress.processed} / {session.progress.total}
              </span>
            </span>
            <span className={styles.progressTrack}>
              {progressPercent > 0 ? (
                <span
                  className={styles.progressFill}
                  style={{ width: `${progressPercent}%` }}
                />
              ) : null}
            </span>
          </button>
        </header>

        <CenterComparisonLedger
          playerA={comparison.player_a}
          playerB={comparison.player_b}
          sections={sections}
        />
        <CompactComparisonMatrix
          playerA={comparison.player_a}
          playerB={comparison.player_b}
          sections={sections}
        />

        <div
          className={styles.voteBar}
          data-testid="vote-controls"
        >
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

        <div
          className={styles.tools}
          data-testid="comparison-tools"
        >
          <button
            className={styles.undo}
            disabled={isSubmitting || !session.can_undo}
            onClick={() => void onUndo()}
            type="button"
          >
            <ArrowIcon direction="left" />
            Undo
          </button>
          <span
            aria-live="polite"
            role="status"
          >
            {statusMessage ?? (isSubmitting ? "Saving" : "Saved")}
          </span>
        </div>
      </div>
    </section>
  );
}
