import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, requestJson } from "@/shared/api/client";

describe("requestJson", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("preserves structured API conflict details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "stale_session",
            message: "Changed in another tab.",
            current_version: 3,
          }),
          {
            status: 409,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    const error = await requestJson("/test").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "stale_session",
      currentVersion: 3,
      message: "Changed in another tab.",
    });
  });

  it("aborts requests that exceed the timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_path: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }),
    );

    const pending = requestJson("/slow", undefined, 50);
    const assertion = expect(pending).rejects.toThrow(
      "Request timed out.",
    );
    await vi.advanceTimersByTimeAsync(50);

    await assertion;
  });
});
