import { requestJson } from "@/shared/api/client";
import type { components } from "@/shared/api/generated/schema";

export type SessionResponse = components["schemas"]["SessionResponse"];
export type ComparisonResponse = components["schemas"]["ComparisonResponse"];
export type AnonymousPlayerResponse =
  components["schemas"]["ComparisonPlayerResponse"];
export type CareerStatsResponse = components["schemas"]["CareerStatsResponse"];
export type HonorsResponse = components["schemas"]["HonorsResponse"];
export type RankingGroupResponse =
  components["schemas"]["RankingGroupResponse"];
export type VoteOutcome = components["schemas"]["VoteOutcome"];

const sessionsPath = "/api/v1/sessions";

export const rankingApi = {
  createSession(
    operationId: string,
    signal?: AbortSignal,
  ): Promise<SessionResponse> {
    return requestJson<SessionResponse>(sessionsPath, {
      method: "POST",
      body: JSON.stringify({ operation_id: operationId }),
      signal,
    });
  },

  getSession(
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<SessionResponse> {
    return requestJson<SessionResponse>(
      `${sessionsPath}/${sessionId}`,
      { signal },
    );
  },

  vote(
    sessionId: string,
    outcome: VoteOutcome,
    operationId: string,
    expectedVersion: number,
    signal?: AbortSignal,
  ): Promise<SessionResponse> {
    return requestJson<SessionResponse>(
      `${sessionsPath}/${sessionId}/votes`,
      {
        method: "POST",
        body: JSON.stringify({
          operation_id: operationId,
          expected_version: expectedVersion,
          outcome,
        }),
        signal,
      },
    );
  },

  undo(
    sessionId: string,
    operationId: string,
    expectedVersion: number,
    signal?: AbortSignal,
  ): Promise<SessionResponse> {
    return requestJson<SessionResponse>(
      `${sessionsPath}/${sessionId}/undo`,
      {
        method: "POST",
        body: JSON.stringify({
          operation_id: operationId,
          expected_version: expectedVersion,
        }),
        signal,
      },
    );
  },

  deleteSession(sessionId: string): Promise<void> {
    return requestJson<void>(`${sessionsPath}/${sessionId}`, {
      method: "DELETE",
    });
  },
};
