import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { rankingApi } from "@/features/ranking/api/rankingApi";
import { useRankingSession } from "@/features/ranking/hooks/useRankingSession";
import { ApiError } from "@/shared/api/client";
import { activeSession } from "@/test/sessionFixture";

vi.mock("@/features/ranking/api/rankingApi", () => ({
  rankingApi: {
    createSession: vi.fn(),
    deleteSession: vi.fn(),
    getSession: vi.fn(),
    undo: vi.fn(),
    vote: vi.fn(),
  },
}));

const CREATE_ID = "00000000-0000-4000-8000-000000000001";
const MUTATION_ID = "00000000-0000-4000-8000-000000000002";

describe("useRankingSession", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce(CREATE_ID)
      .mockReturnValue(MUTATION_ID);
  });

  it("creates and stores a session with a persistent operation ID", async () => {
    vi.mocked(rankingApi.createSession).mockResolvedValue(activeSession());

    const { result } = renderHook(() => useRankingSession());

    await waitFor(() => {
      expect(result.current.session?.id).toBe("session-1");
    });
    expect(rankingApi.createSession).toHaveBeenCalledWith(
      CREATE_ID,
      { preset: "top_25", identityMode: "normal" },
      expect.any(AbortSignal),
    );
    expect(window.localStorage.getItem("blind50.session_id")).toBe("session-1");
    expect(window.localStorage.getItem("blind50.session_version")).toBe("0");
    expect(
      window.localStorage.getItem("blind50.pending_create_operation"),
    ).toBeNull();
  });

  it("restores a saved session without creating another one", async () => {
    window.localStorage.setItem("blind50.session_id", "session-1");
    vi.mocked(rankingApi.getSession).mockResolvedValue(activeSession());

    const { result } = renderHook(() => useRankingSession());

    await waitFor(() => {
      expect(result.current.session?.id).toBe("session-1");
    });
    expect(rankingApi.createSession).not.toHaveBeenCalled();
  });

  it("passes operation ID and expected version with a vote", async () => {
    vi.mocked(rankingApi.createSession).mockResolvedValue(activeSession());
    const voted = {
      ...activeSession(),
      version: 1,
      progress: { ...activeSession().progress, votes: 9 },
    };
    vi.mocked(rankingApi.vote).mockResolvedValue(voted);
    const { result } = renderHook(() => useRankingSession());
    await waitFor(() => expect(result.current.session).not.toBeNull());

    await act(async () => {
      await result.current.vote("tie");
    });

    expect(rankingApi.vote).toHaveBeenCalledWith(
      "session-1",
      "tie",
      MUTATION_ID,
      0,
    );
    expect(result.current.session?.version).toBe(1);
  });

  it("refetches instead of overwriting after a stale-session conflict", async () => {
    vi.mocked(rankingApi.createSession).mockResolvedValue(activeSession());
    const refreshed = { ...activeSession(), version: 1 };
    vi.mocked(rankingApi.vote).mockRejectedValue(
      new ApiError(
        409,
        "Changed in another tab.",
        "stale_session",
        1,
      ),
    );
    vi.mocked(rankingApi.getSession).mockResolvedValue(refreshed);
    const { result } = renderHook(() => useRankingSession());
    await waitFor(() => expect(result.current.session).not.toBeNull());

    await act(async () => {
      await result.current.vote("better");
    });

    expect(rankingApi.getSession).toHaveBeenCalledWith("session-1");
    expect(result.current.session?.version).toBe(1);
    expect(result.current.statusMessage).toContain("another tab");
  });

  it("replaces an expired saved session", async () => {
    window.localStorage.setItem("blind50.session_id", "expired-session");
    window.localStorage.setItem(
      "blind50.ranking_selection",
      JSON.stringify({ preset: "top_10", identityMode: "blind" }),
    );
    vi.mocked(rankingApi.getSession).mockRejectedValue(
      new ApiError(410, "Expired.", "session_expired"),
    );
    vi.mocked(rankingApi.createSession).mockResolvedValue({
      ...activeSession(),
      preset: "top_10",
      identity_mode: "blind",
    });

    const { result } = renderHook(() => useRankingSession());

    await waitFor(() => {
      expect(result.current.session?.id).toBe("session-1");
    });
    expect(result.current.error).toBeNull();
    expect(rankingApi.createSession).toHaveBeenCalledWith(
      CREATE_ID,
      { preset: "top_10", identityMode: "blind" },
      expect.any(AbortSignal),
    );
    expect(window.localStorage.getItem("blind50.session_id")).toBe("session-1");
  });

  it("ignores an idempotent response older than local state", async () => {
    const current = { ...activeSession(), version: 2 };
    vi.mocked(rankingApi.createSession).mockResolvedValue(current);
    vi.mocked(rankingApi.vote).mockResolvedValue({
      ...activeSession(),
      version: 1,
    });
    const { result } = renderHook(() => useRankingSession());
    await waitFor(() => expect(result.current.session?.version).toBe(2));

    await act(async () => {
      await result.current.vote("worse");
    });

    expect(result.current.session?.version).toBe(2);
  });

  it("blocks duplicate local submissions", async () => {
    vi.mocked(rankingApi.createSession).mockResolvedValue(activeSession());
    let resolveVote: ((value: ReturnType<typeof activeSession>) => void) | null =
      null;
    vi.mocked(rankingApi.vote).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveVote = resolve;
        }),
    );
    const { result } = renderHook(() => useRankingSession());
    await waitFor(() => expect(result.current.session).not.toBeNull());

    let first: Promise<void>;
    let second: Promise<void>;
    act(() => {
      first = result.current.vote("better");
      second = result.current.vote("worse");
    });
    expect(rankingApi.vote).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveVote?.({ ...activeSession(), version: 1 });
      await Promise.all([first, second]);
    });
  });

  it("switches modes by creating the replacement before deleting", async () => {
    const replacement = {
      ...activeSession(),
      id: "session-2",
      preset: "top_10" as const,
      identity_mode: "blind" as const,
    };
    vi.mocked(rankingApi.createSession)
      .mockResolvedValueOnce(activeSession())
      .mockResolvedValueOnce(replacement);
    vi.mocked(rankingApi.deleteSession).mockResolvedValue();
    const { result } = renderHook(() => useRankingSession());
    await waitFor(() => expect(result.current.session).not.toBeNull());

    let changed = false;
    await act(async () => {
      changed = await result.current.startNewRanking({
        preset: "top_10",
        identityMode: "blind",
      });
    });

    expect(changed).toBe(true);
    expect(result.current.session).toMatchObject({
      id: "session-2",
      preset: "top_10",
      identity_mode: "blind",
    });
    expect(rankingApi.createSession).toHaveBeenNthCalledWith(
      2,
      MUTATION_ID,
      { preset: "top_10", identityMode: "blind" },
      undefined,
    );
    expect(
      vi.mocked(rankingApi.createSession).mock.invocationCallOrder[1],
    ).toBeLessThan(
      vi.mocked(rankingApi.deleteSession).mock.invocationCallOrder[0],
    );
  });

  it("keeps the current session when a mode change fails", async () => {
    vi.mocked(rankingApi.createSession)
      .mockResolvedValueOnce(activeSession())
      .mockRejectedValueOnce(new Error("Offline"));
    const { result } = renderHook(() => useRankingSession());
    await waitFor(() => expect(result.current.session).not.toBeNull());

    let changed = true;
    await act(async () => {
      changed = await result.current.startNewRanking({
        preset: "top_50",
        identityMode: "blind",
      });
    });

    expect(changed).toBe(false);
    expect(result.current.session?.id).toBe("session-1");
    expect(rankingApi.deleteSession).not.toHaveBeenCalled();
  });

  it("does not crash when local storage is unavailable", async () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new DOMException("Blocked");
      });
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Blocked");
      });
    vi.mocked(rankingApi.createSession).mockResolvedValue(activeSession());

    const { result } = renderHook(() => useRankingSession());

    await waitFor(() => {
      expect(result.current.session?.id).toBe("session-1");
    });
    expect(result.current.error).toBeNull();
    getItem.mockRestore();
    setItem.mockRestore();
  });

  it("exposes retry after initial loading fails", async () => {
    vi.mocked(rankingApi.createSession)
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce(activeSession());
    const { result } = renderHook(() => useRankingSession());
    await waitFor(() => expect(result.current.error).toBe("Offline"));

    act(() => result.current.retry());

    await waitFor(() => {
      expect(result.current.session?.id).toBe("session-1");
    });
    expect(result.current.error).toBeNull();
  });

  it("keeps a failed create operation bound to its selected mode", async () => {
    vi.mocked(rankingApi.createSession).mockRejectedValue(new Error("Offline"));

    const { result } = renderHook(() => useRankingSession());

    await waitFor(() => expect(result.current.error).toBe("Offline"));
    expect(
      JSON.parse(
        window.localStorage.getItem(
          "blind50.pending_create_operation",
        ) ?? "{}",
      ),
    ).toEqual({
      operationId: CREATE_ID,
      preset: "top_25",
      identityMode: "normal",
    });
  });
});
