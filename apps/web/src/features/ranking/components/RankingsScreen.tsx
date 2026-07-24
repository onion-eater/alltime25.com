import { useMemo, useState } from "react";

import type { SessionResponse } from "@/features/ranking/api/rankingApi";
import { RankingRow } from "@/features/ranking/components/RankingRow";
import styles from "@/features/ranking/components/RankingsScreen.module.css";
import { flattenRanking } from "@/features/ranking/model/rankingRows";
import { shareRankingImage } from "@/features/ranking/share/shareRankingImage";
import { ArrowIcon } from "@/shared/components/ArrowIcon";

const PAGE_SIZE = 10;

interface RankingsScreenProps {
  isSubmitting?: boolean;
  onStartOver: () => void | Promise<void>;
  session: SessionResponse;
  statusMessage?: string;
}

export function RankingsScreen({
  isSubmitting = false,
  onStartOver,
  session,
  statusMessage = "",
}: RankingsScreenProps): React.JSX.Element {
  const [page, setPage] = useState(0);
  const [actionStatus, setActionStatus] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const rows = useMemo(() => flattenRanking(session.ranking ?? []), [session]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const firstIndex = safePage * PAGE_SIZE;
  const visibleRows = rows.slice(firstIndex, firstIndex + PAGE_SIZE);
  const lastIndex = firstIndex + visibleRows.length;

  const tieCount = (session.ranking ?? []).filter(
    (group) => group.players.length > 1,
  ).length;

  async function shareRanking(): Promise<void> {
    if (isSharing || session.ranking === null) return;
    setIsSharing(true);
    setActionStatus("Creating image.");
    try {
      setActionStatus(
        await shareRankingImage(
          session.ranking,
          session.target_size,
        ),
      );
    } catch {
      setActionStatus("Share failed.");
    } finally {
      setIsSharing(false);
    }
  }

  async function startOver(): Promise<void> {
    setActionStatus("");
    await onStartOver();
  }

  return (
    <section className={styles.screen}>
      <div className={`page-shell ${styles.layout}`}>
        <header className={styles.header}>
          <div>
            <h1>Your NBA top {session.target_size}.</h1>
            <p className={styles.summary}>
              {session.progress.votes} votes · {tieCount} ties · {rows.length} players
            </p>
          </div>
          <div className={styles.complete}>
            Complete · {session.progress.processed} / {session.pool_size}
          </div>
        </header>

        <div className={styles.content}>
          <div className={styles.list}>
            {visibleRows.map((row) => (
              <RankingRow
                key={`${row.rank}-${row.player.name}`}
                player={row.player}
                rankLabel={row.isTied ? `T-${row.rank}` : String(row.rank)}
              />
            ))}
            <div className={styles.pagination}>
              <button
                aria-label="Previous ranking page"
                disabled={safePage === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                type="button"
              >
                <ArrowIcon direction="left" />
              </button>
              <span className={styles.range}>
                <span>
                  <strong>
                    {rows.length === 0 ? 0 : firstIndex + 1}–{lastIndex}
                  </strong>{" "}
                  of {rows.length}
                </span>
              </span>
              <button
                aria-label="Next ranking page"
                disabled={safePage >= pageCount - 1}
                onClick={() =>
                  setPage((current) => Math.min(pageCount - 1, current + 1))
                }
                type="button"
              >
                <ArrowIcon />
              </button>
            </div>
          </div>

          <aside className={styles.actions}>
            <h2>Your result</h2>
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
