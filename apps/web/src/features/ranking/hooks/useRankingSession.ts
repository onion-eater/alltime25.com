import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  loadCatalog,
  loadCurrentCatalog,
} from "@/features/ranking/catalog/catalogRepository";
import type { RankingSelection } from "@/features/ranking/domain/player";
import type { VoteOutcome } from "@/features/ranking/domain/ranking";
import { DEFAULT_RANKING_SELECTION } from "@/features/ranking/model/rankingSelection";
import {
  mutateStoredSession,
  postSessionNotification,
  RANKING_CHANNEL_NAME,
  replaceCorruptStoredSession,
  sessionExpectation,
  type StoredMutationResult,
} from "@/features/ranking/persistence/localRankingStore";
import {
  clearLegacySessionKeys,
  parsePersistedSession,
  readPersistedSessionRaw,
  type PersistedRankingSessionV1,
} from "@/features/ranking/persistence/persistedSession";
import {
  applySessionVote,
  createRankingSession,
  undoSessionVote,
} from "@/features/ranking/session/rankingSession";
import {
  buildRankingSessionView,
  type RankingSessionView,
} from "@/features/ranking/session/sessionView";

export interface RankingSessionController {
  session: RankingSessionView | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  statusMessage: string;
  vote: (outcome: VoteOutcome) => Promise<void>;
  undo: () => Promise<void>;
  startNewRanking: (selection: RankingSelection) => Promise<boolean>;
  retry: () => void;
}

interface UseRankingSessionOptions {
  deferInitialCreation?: boolean;
}

export function useRankingSession(
  options: UseRankingSessionOptions = {},
): RankingSessionController {
  const { deferInitialCreation = false } = options;
  const [session, setSession] = useState<RankingSessionView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const persistedRef = useRef<PersistedRankingSessionV1 | null>(null);
  const corruptRawRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const adoptionSequenceRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const adoptPersistedSession = useCallback(
    async (
      next: PersistedRankingSessionV1,
      nextStatus?: string,
    ): Promise<boolean> => {
      const current = persistedRef.current;
      if (
        current?.id === next.id &&
        current.revision > next.revision
      ) {
        return false;
      }
      const adoptionSequence = ++adoptionSequenceRef.current;
      const catalog = await loadCatalog(next.catalogId);
      const view = buildRankingSessionView(next, catalog);
      if (
        !mountedRef.current ||
        adoptionSequence !== adoptionSequenceRef.current
      ) {
        return false;
      }
      persistedRef.current = next;
      corruptRawRef.current = null;
      setSession(view);
      setError(null);
      if (nextStatus !== undefined) setStatusMessage(nextStatus);
      return true;
    },
    [],
  );

  const adoptMutationResult = useCallback(
    async (
      result: StoredMutationResult,
      savedStatus = "Saved",
    ): Promise<"saved" | "stale" | "cleared"> => {
      if (result.session === null) return "cleared";
      const status =
        result.status === "saved"
          ? savedStatus
          : "Updated from another tab.";
      await adoptPersistedSession(result.session, status);
      if (result.status === "saved") {
        postSessionNotification(channelRef.current, result.session);
      }
      return result.status;
    },
    [adoptPersistedSession],
  );

  const createAfterClear = useCallback(
    async (selection: RankingSelection): Promise<void> => {
      const catalog = await loadCurrentCatalog();
      const replacement = createRankingSession(catalog, selection);
      const result = await mutateStoredSession(
        null,
        () => replacement,
      );
      await adoptMutationResult(result, "New ranking started.");
    },
    [adoptMutationResult],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSession(): Promise<void> {
      setIsLoading(true);
      setError(null);
      setStatusMessage("Loading");
      try {
        clearLegacySessionKeys();
        const raw = readPersistedSessionRaw();
        if (raw === null && deferInitialCreation) {
          persistedRef.current = null;
          corruptRawRef.current = null;
          setSession(null);
          setStatusMessage("Choose a mode");
          return;
        }
        let loaded: PersistedRankingSessionV1;
        let created = false;
        if (raw === null) {
          const catalog = await loadCurrentCatalog();
          const candidate = createRankingSession(
            catalog,
            DEFAULT_RANKING_SELECTION,
          );
          const result = await mutateStoredSession(
            null,
            () => candidate,
          );
          if (result.session === null) {
            throw new Error("Ranking creation did not save.");
          }
          loaded = result.session;
          created = result.status === "saved";
        } else {
          try {
            loaded = parsePersistedSession(raw);
          } catch (loadError) {
            corruptRawRef.current = raw;
            throw loadError;
          }
          persistedRef.current = loaded;
        }
        if (cancelled) return;
        const adopted = await adoptPersistedSession(loaded, "Saved");
        if (created && adopted) {
          postSessionNotification(channelRef.current, loaded);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(messageFor(loadError));
          setStatusMessage("Retry");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, [adoptPersistedSession, deferInitialCreation, loadAttempt]);

  useEffect(() => {
    let cancelled = false;

    async function synchronize(): Promise<void> {
      try {
        const raw = readPersistedSessionRaw();
        if (raw === null) return;
        let updated: PersistedRankingSessionV1;
        try {
          updated = parsePersistedSession(raw);
        } catch (syncError) {
          corruptRawRef.current = raw;
          throw syncError;
        }
        const current = persistedRef.current;
        if (
          current?.id === updated.id &&
          current.revision >= updated.revision
        ) {
          return;
        }
        if (!cancelled) {
          await adoptPersistedSession(
            updated,
            "Updated from another tab.",
          );
        }
      } catch (syncError) {
        if (!cancelled) {
          setError(messageFor(syncError));
          setStatusMessage("Retry");
        }
      }
    }

    function onStorage(event: StorageEvent): void {
      if (event.key === "alltime25.ranking-session.v1") {
        void synchronize();
      }
    }

    window.addEventListener("storage", onStorage);
    if ("BroadcastChannel" in window) {
      try {
        const channel = new BroadcastChannel(RANKING_CHANNEL_NAME);
        channelRef.current = channel;
        channel.onmessage = () => void synchronize();
      } catch {
        channelRef.current = null;
      }
    }
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [adoptPersistedSession]);

  const runMutation = useCallback(
    async (
      transform: (
        current: PersistedRankingSessionV1,
      ) => PersistedRankingSessionV1,
    ): Promise<void> => {
      const current = persistedRef.current;
      if (current === null || submittingRef.current) return;
      submittingRef.current = true;
      setIsSubmitting(true);
      setError(null);
      setStatusMessage("Saving");
      try {
        const result = await mutateStoredSession(
          sessionExpectation(current),
          (stored) => {
            if (stored === null) {
              throw new Error("Saved ranking was cleared.");
            }
            return transform(stored);
          },
        );
        const outcome = await adoptMutationResult(result);
        if (outcome === "cleared") {
          await createAfterClear(selectionFor(current));
        }
      } catch (mutationError) {
        setError(messageFor(mutationError));
        setStatusMessage("Retry");
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [adoptMutationResult, createAfterClear],
  );

  const vote = useCallback(
    async (outcome: VoteOutcome): Promise<void> => {
      await runMutation((current) =>
        applySessionVote(current, outcome),
      );
    },
    [runMutation],
  );

  const undo = useCallback(async (): Promise<void> => {
    await runMutation(undoSessionVote);
  }, [runMutation]);

  const startNewRanking = useCallback(
    async (selection: RankingSelection): Promise<boolean> => {
      if (submittingRef.current) return false;
      const current = persistedRef.current;
      const corruptRaw = corruptRawRef.current;
      submittingRef.current = true;
      setIsSubmitting(true);
      setError(null);
      setStatusMessage("Starting");
      try {
        const catalog = await loadCurrentCatalog();
        const replacement = createRankingSession(catalog, selection);
        let result =
          corruptRaw === null
            ? await mutateStoredSession(
                current === null ? null : sessionExpectation(current),
                () => replacement,
              )
            : await replaceCorruptStoredSession(corruptRaw, replacement);

        if (result.status === "stale" && result.session === null) {
          result = await mutateStoredSession(
            null,
            () => replacement,
          );
        }
        const outcome = await adoptMutationResult(result);
        return outcome === "saved";
      } catch (mutationError) {
        setError(messageFor(mutationError));
        setStatusMessage("Retry");
        return false;
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [adoptMutationResult],
  );

  const retry = useCallback((): void => {
    setLoadAttempt((current) => current + 1);
  }, []);

  return {
    session,
    isLoading,
    isSubmitting,
    error,
    statusMessage,
    vote,
    undo,
    startNewRanking,
    retry,
  };
}

function selectionFor(
  session: PersistedRankingSessionV1,
): RankingSelection {
  return {
    preset: session.preset,
    identityMode: session.identityMode,
  };
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
