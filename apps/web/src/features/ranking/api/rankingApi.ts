import { requestJson } from "@/shared/api/client";
import type { components } from "@/shared/api/generated/schema";

export type SessionResponse = components["schemas"]["SessionResponse"];
export type ComparisonResponse = components["schemas"]["ComparisonResponse"];
export type AnonymousPlayerResponse =
  ComparisonResponse["player_a"];
export type CareerStatsResponse = components["schemas"]["CareerStatsResponse"];
export type HonorsResponse = components["schemas"]["HonorsResponse"];
export type RankingGroupResponse =
  components["schemas"]["RankingGroupResponse"];
export type VoteOutcome = components["schemas"]["VoteOutcome"];
export type RankingPreset = components["schemas"]["RankingPreset"];
export type IdentityMode = components["schemas"]["IdentityMode"];

export interface RankingSelection {
  preset: RankingPreset;
  identityMode: IdentityMode;
}

const sessionsPath = "/api/v1/sessions";

export const rankingApi = {
  createSession(
    operationId: string,
    selection: RankingSelection,
    signal?: AbortSignal,
  ): Promise<SessionResponse> {
    return requestJson<SessionResponse>(sessionsPath, {
      method: "POST",
      body: JSON.stringify({
        operation_id: operationId,
        preset: selection.preset,
        identity_mode: selection.identityMode,
      }),
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
