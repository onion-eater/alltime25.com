from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from blind50.domain.ranking import RankingState, VoteOutcome


@dataclass(frozen=True)
class StoredRankingSession:
    id: str
    catalog_id: str
    player_order: tuple[str, ...]
    state: RankingState
    version: int
    can_undo: bool
    created_at: datetime
    updated_at: datetime
    expires_at: datetime


class SessionRepositoryError(RuntimeError):
    pass


class SessionNotFoundError(SessionRepositoryError):
    pass


class SessionExpiredError(SessionRepositoryError):
    pass


class StaleSessionError(SessionRepositoryError):
    def __init__(self, current_version: int) -> None:
        super().__init__("The session changed in another tab.")
        self.current_version = current_version


class IdempotencyConflictError(SessionRepositoryError):
    def __init__(self, current_version: int | None) -> None:
        super().__init__("The operation ID was already used for another request.")
        self.current_version = current_version


class NothingToUndoError(SessionRepositoryError):
    def __init__(self, current_version: int) -> None:
        super().__init__("There is no active vote to undo.")
        self.current_version = current_version


class RankingCompleteError(SessionRepositoryError):
    def __init__(self, current_version: int) -> None:
        super().__init__("The ranking is already complete.")
        self.current_version = current_version


class CorruptSessionError(SessionRepositoryError):
    pass


class SessionRepository(Protocol):
    def create(
        self,
        session: StoredRankingSession,
        *,
        operation_id: str,
        request_hash: str,
    ) -> StoredRankingSession: ...

    def get(
        self,
        session_id: str,
        *,
        now: datetime,
    ) -> StoredRankingSession: ...

    def vote(
        self,
        session_id: str,
        *,
        operation_id: str,
        request_hash: str,
        expected_version: int,
        outcome: VoteOutcome,
        now: datetime,
        expires_at: datetime,
    ) -> StoredRankingSession: ...

    def undo(
        self,
        session_id: str,
        *,
        operation_id: str,
        request_hash: str,
        expected_version: int,
        now: datetime,
        expires_at: datetime,
    ) -> StoredRankingSession: ...

    def delete(self, session_id: str) -> None: ...

    def cleanup_expired(self, *, now: datetime) -> int: ...

    def ping(self) -> None: ...
