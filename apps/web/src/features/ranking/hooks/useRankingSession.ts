import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  rankingApi,
  type SessionResponse,
  type VoteOutcome,
} from "@/features/ranking/api/rankingApi";
import { ApiError } from "@/shared/api/client";
import {
  storageGet,
  storageRemove,
  storageSet,
} from "@/shared/browser/safeStorage";

const SESSION_KEY = "blind50.session_id";
const VERSION_KEY = "blind50.session_version";
const PENDING_CREATE_KEY = "blind50.pending_create_operation";
const CHANNEL_NAME = "blind50-session";

let volatilePendingCreateId: string | null = null;

export interface RankingSessionController {
  session: SessionResponse | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  statusMessage: string;
  vote: (outcome: VoteOutcome) => Promise<void>;
  undo: () => Promise<void>;
  startOver: () => Promise<void>;
  retry: () => void;
}

export function useRankingSession(): RankingSessionController {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const sessionRef = useRef<SessionResponse | null>(null);
  const submittingRef = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const adoptSession = useCallback(
    (next: SessionResponse, broadcast = true): void => {
      const current = sessionRef.current;
      if (
        current?.id === next.id &&
        next.version < current.version
      ) {
        return;
      }
      sessionRef.current = next;
      setSession(next);
      storageSet(SESSION_KEY, next.id);
      storageSet(VERSION_KEY, String(next.version));
      if (broadcast) {
        channelRef.current?.postMessage({
          id: next.id,
          version: next.version,
        });
      }
    },
    [],
  );

  const createSession = useCallback(
    async (signal?: AbortSignal): Promise<SessionResponse> => {
      const operationId =
        storageGet(PENDING_CREATE_KEY) ??
        volatilePendingCreateId ??
        crypto.randomUUID();
      volatilePendingCreateId = operationId;
      storageSet(PENDING_CREATE_KEY, operationId);
      const created = await rankingApi.createSession(operationId, signal);
      volatilePendingCreateId = null;
      storageRemove(PENDING_CREATE_KEY);
      return created;
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function loadSession(): Promise<void> {
      setIsLoading(true);
      setError(null);
      setStatusMessage("Loading");
      try {
        const storedSessionId = storageGet(SESSION_KEY);
        let loaded: SessionResponse;
        if (storedSessionId) {
          try {
            loaded = await rankingApi.getSession(
              storedSessionId,
              controller.signal,
            );
          } catch (loadError) {
            if (
              !(loadError instanceof ApiError) ||
              ![404, 410].includes(loadError.status)
            ) {
              throw loadError;
            }
            storageRemove(SESSION_KEY);
            storageRemove(VERSION_KEY);
            loaded = await createSession(controller.signal);
            setStatusMessage(
              loadError.status === 410
                ? "Session expired. New ranking started."
                : "New ranking started.",
            );
          }
        } else {
          loaded = await createSession(controller.signal);
        }
        if (!cancelled) {
          adoptSession(loaded);
          setStatusMessage("Saved");
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
      controller.abort();
    };
  }, [adoptSession, createSession, loadAttempt]);

  useEffect(() => {
    let cancelled = false;

    async function synchronize(
      sessionId: string,
      version: number,
    ): Promise<void> {
      const current = sessionRef.current;
      if (
        current?.id === sessionId &&
        current.version >= version
      ) {
        return;
      }
      try {
        const updated = await rankingApi.getSession(sessionId);
        if (!cancelled) {
          adoptSession(updated, false);
          setStatusMessage("Updated from another tab.");
        }
      } catch {
        // The active tab handles recovery when the user next interacts.
      }
    }

    function onStorage(event: StorageEvent): void {
      if (event.key !== SESSION_KEY && event.key !== VERSION_KEY) return;
      const sessionId = storageGet(SESSION_KEY);
      const version = Number(storageGet(VERSION_KEY) ?? "0");
      if (sessionId) void synchronize(sessionId, version);
    }

    window.addEventListener("storage", onStorage);
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current = channel;
      channel.onmessage = (
        event: MessageEvent<{ id?: unknown; version?: unknown }>,
      ) => {
        if (
          typeof event.data.id === "string" &&
          typeof event.data.version === "number"
        ) {
          void synchronize(event.data.id, event.data.version);
        }
      };
    }
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [adoptSession]);

  const runMutation = useCallback(
    async (
      mutation: (
        currentSession: SessionResponse,
        operationId: string,
      ) => Promise<SessionResponse>,
    ): Promise<void> => {
      const current = sessionRef.current;
      if (current === null || submittingRef.current) return;
      submittingRef.current = true;
      setIsSubmitting(true);
      setError(null);
      setStatusMessage("Saving");
      const operationId = crypto.randomUUID();
      try {
        let updated: SessionResponse;
        try {
          updated = await mutation(current, operationId);
        } catch (firstError) {
          if (firstError instanceof ApiError) throw firstError;
          setStatusMessage("Retrying");
          updated = await mutation(current, operationId);
        }
        adoptSession(updated);
        setStatusMessage("Saved");
      } catch (mutationError) {
        if (
          mutationError instanceof ApiError &&
          mutationError.code === "stale_session"
        ) {
          try {
            const refreshed = await rankingApi.getSession(current.id);
            adoptSession(refreshed);
            setStatusMessage("Updated from another tab.");
          } catch (refreshError) {
            setError(messageFor(refreshError));
            setStatusMessage("Retry");
          }
        } else if (
          mutationError instanceof ApiError &&
          [404, 410].includes(mutationError.status)
        ) {
          try {
            const replacement = await createSession();
            adoptSession(replacement);
            setStatusMessage(
              mutationError.status === 410
                ? "Session expired. New ranking started."
                : "New ranking started.",
            );
          } catch (replacementError) {
            setError(messageFor(replacementError));
            setStatusMessage("Retry");
          }
        } else {
          setError(messageFor(mutationError));
          setStatusMessage("Retry");
        }
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [adoptSession, createSession],
  );

  const vote = useCallback(
    async (outcome: VoteOutcome): Promise<void> => {
      await runMutation((current, operationId) =>
        rankingApi.vote(
          current.id,
          outcome,
          operationId,
          current.version,
        ),
      );
    },
    [runMutation],
  );

  const undo = useCallback(async (): Promise<void> => {
    await runMutation((current, operationId) =>
      rankingApi.undo(
        current.id,
        operationId,
        current.version,
      ),
    );
  }, [runMutation]);

  const startOver = useCallback(async (): Promise<void> => {
    if (submittingRef.current) return;
    const current = sessionRef.current;
    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    setStatusMessage("Starting");
    try {
      const created = await createSession();
      adoptSession(created);
      setStatusMessage("Saved");
      if (current !== null) {
        try {
          await rankingApi.deleteSession(current.id);
        } catch {
          setStatusMessage("New ranking saved.");
        }
      }
    } catch (mutationError) {
      setError(messageFor(mutationError));
      setStatusMessage("Retry");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [adoptSession, createSession]);

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
    startOver,
    retry,
  };
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
