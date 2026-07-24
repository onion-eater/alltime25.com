import type { components } from "@/shared/api/generated/schema";

type ApiErrorResponse = components["schemas"]["ApiErrorResponse"];

const DEFAULT_TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly currentVersion: number | null;

  constructor(
    status: number,
    message: string,
    code: string | null = null,
    currentVersion: number | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.currentVersion = currentVersion;
  }
}

export async function requestJson<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const timeoutController = new AbortController();
  const timeout = globalThis.setTimeout(
    () => timeoutController.abort(),
    timeoutMs,
  );
  const callerSignal = init?.signal;
  const abortFromCaller = (): void => timeoutController.abort();
  callerSignal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
      signal: timeoutController.signal,
    });

    if (!response.ok) {
      throw await errorFor(response);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  } catch (error) {
    if (
      timeoutController.signal.aborted &&
      callerSignal?.aborted !== true
    ) {
      throw new Error("Request timed out.", { cause: error });
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}

async function errorFor(response: Response): Promise<ApiError> {
  let message = `Request failed with status ${response.status}.`;
  let code: string | null = null;
  let currentVersion: number | null = null;
  try {
    const body = (await response.json()) as
      | ApiErrorResponse
      | { detail?: string };
    if ("message" in body && typeof body.message === "string") {
      message = body.message;
      code = body.code;
      currentVersion = body.current_version;
    } else if ("detail" in body && typeof body.detail === "string") {
      message = body.detail;
    }
  } catch {
    // The HTTP status remains useful for non-JSON responses.
  }
  return new ApiError(response.status, message, code, currentVersion);
}
