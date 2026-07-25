import { useMemo, useState } from "react";

import { RankingRow } from "@/features/ranking/components/RankingRow";
import styles from "@/features/ranking/components/RankingsScreen.module.css";
import {
  flattenActiveRanking,
  flattenRanking,
} from "@/features/ranking/model/rankingRows";
import { shareRankingImage } from "@/features/ranking/share/shareRankingImage";
import type { RankingSessionView } from "@/features/ranking/session/sessionView";
import { ArrowIcon } from "@/shared/components/ArrowIcon";

interface RankingsScreenProps {
  isSubmitting?: boolean;
  onResume?: () => void;
  onStartOver?: () => void | Promise<void>;
  session: RankingSessionView;
  statusMessage?: string;
}

export function RankingsScreen({
  isSubmitting = false,
  onResume,
  onStartOver,
  session,
  statusMessage = "",
}: RankingsScreenProps): React.JSX.Element {
  const [actionStatus, setActionStatus] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const isComplete = session.status === "complete";
  const rows = useMemo(
    () =>
      isComplete
        ? flattenRanking(session.ranking ?? [])
        : flattenActiveRanking(session.rankingPreview ?? []),
    [isComplete, session.ranking, session.rankingPreview],
  );
  const groups = isComplete
    ? session.ranking ?? []
    : session.rankingPreview ?? [];
  const tieCount = groups.filter(
    (group) => group.players.length > 1,
  ).length;

  async function shareRanking(): Promise<void> {
    if (!isComplete || isSharing || session.ranking === null) return;
    setIsSharing(true);
    setActionStatus("Creating image.");
    try {
      setActionStatus(
        await shareRankingImage(
          session.ranking,
          session.targetSize,
        ),
      );
    } catch {
      setActionStatus("Share failed.");
    } finally {
      setIsSharing(false);
    }
  }

  async function startOver(): Promise<void> {
    if (!onStartOver) return;
    setActionStatus("");
    await onStartOver();
  }

  return (
    <section className={styles.screen}>
      <div className={`page-shell ${styles.layout}`}>
        <header className={styles.header}>
          <div>
            <h1>
              {isComplete
                ? `Your NBA top ${session.targetSize}.`
                : "Your ranking so far."}
            </h1>
            <p className={styles.summary}>
              {session.progress.votes} votes · {tieCount} ties · {rows.length}{" "}
              {isComplete ? "players" : "ranked"}
            </p>
          </div>
          <div
            className={`${styles.complete} ${isComplete ? "" : styles.inProgress}`}
          >
            {isComplete ? "Complete" : "In progress"} ·{" "}
            {session.progress.processed} / {session.poolSize}
          </div>
        </header>

        <div className={styles.content}>
          <div
            aria-label="Ranking list"
            className={styles.list}
            data-testid="ranking-list"
            role="region"
            tabIndex={0}
          >
            {rows.map((row) => (
              <RankingRow
                key={`${row.rank}-${"name" in row.player ? row.player.name : row.player.code}`}
                player={row.player}
                rankLabel={row.isTied ? `T-${row.rank}` : String(row.rank)}
              />
            ))}
          </div>

          <aside
            className={`${styles.actions} ${isComplete ? "" : styles.resumeActions}`}
          >
            <h2>{isComplete ? "Your result" : "Ranking paused"}</h2>
            {isComplete ? (
              <>
                <button
                  className={styles.action}
                  disabled={isSharing}
                  onClick={() => void shareRanking()}
                  type="button"
                >
                  Share <ArrowIcon />
                </button>
                <button
                  className={styles.action}
                  disabled={isSubmitting}
                  onClick={() => void startOver()}
                  type="button"
                >
                  Start over <ArrowIcon />
                </button>
              </>
            ) : (
              <button
                className={`${styles.action} ${styles.resumeAction}`}
                onClick={onResume}
                type="button"
              >
                Resume <ArrowIcon />
              </button>
            )}
          </aside>
        </div>
        <p
          aria-live="polite"
          className="sr-only"
          role="status"
        >
          {actionStatus || statusMessage}
        </p>
      </div>
    </section>
  );
}
