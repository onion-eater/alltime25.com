import { useMemo, useState } from "react";

import type {
  RankingGroupResponse,
  SessionResponse,
} from "@/features/ranking/api/rankingApi";
import { RankingRow } from "@/features/ranking/components/RankingRow";
import styles from "@/features/ranking/components/RankingsScreen.module.css";
import { ArrowIcon } from "@/shared/components/ArrowIcon";

const PAGE_SIZE = 10;

interface RankingsScreenProps {
  isSubmitting?: boolean;
  onStartOver: () => void | Promise<void>;
  session: SessionResponse;
  statusMessage?: string;
}

interface DisplayRow {
  isTied: boolean;
  player: RankingGroupResponse["players"][number];
  rank: number;
}

export function RankingsScreen({
  isSubmitting = false,
  onStartOver,
  session,
  statusMessage = "",
}: RankingsScreenProps): React.JSX.Element {
  const [page, setPage] = useState(0);
  const [actionStatus, setActionStatus] = useState("");
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
    const text = rankingText(rows);
    if (navigator.share) {
      try {
        await navigator.share({ title: "My AllTime 25", text });
        setActionStatus("Shared.");
      } catch (error) {
        setActionStatus(
          error instanceof DOMException && error.name === "AbortError"
            ? "Share cancelled."
            : "Share failed.",
        );
      }
      return;
    }
    if (!navigator.clipboard?.writeText) {
      setActionStatus("Share unavailable.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setActionStatus("Copied.");
    } catch {
      setActionStatus("Copy failed.");
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
            <p className={styles.eyebrow}>Your ranking</p>
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
            <p className={styles.note}>Ties at the cutoff are included.</p>
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

function flattenRanking(
  groups: readonly RankingGroupResponse[],
): DisplayRow[] {
  return groups.flatMap((group) =>
    group.players.map((player) => ({
      isTied: group.players.length > 1,
      player,
      rank: group.rank,
    })),
  );
}

function rankingText(rows: readonly DisplayRow[]): string {
  return rows
    .map((row) => `${row.isTied ? "T-" : ""}${row.rank}. ${row.player.name}`)
    .join("\n");
}
