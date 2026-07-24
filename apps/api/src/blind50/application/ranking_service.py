from __future__ import annotations

import hashlib
import json
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from random import SystemRandom
from uuid import uuid4

from blind50.application.ports.player_catalog import (
    PlayerCatalog,
    PlayerCatalogRegistry,
)
from blind50.application.ports.session_repository import (
    CorruptSessionError,
    IdempotencyConflictError,
    NothingToUndoError,
    RankingCompleteError,
    SessionExpiredError,
    SessionNotFoundError,
    SessionRepository,
    StaleSessionError,
    StoredRankingSession,
)
from blind50.domain.ranking import VoteOutcome, start_ranking

SESSION_RETENTION = timedelta(days=90)


class RankingService:
    def __init__(
        self,
        catalog_registry: PlayerCatalogRegistry,
        repository: SessionRepository,
        *,
        shuffler: Callable[[list[str]], None] | None = None,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self.catalog_registry = catalog_registry
        self.repository = repository
        self.shuffler = shuffler or SystemRandom().shuffle
        self.clock = clock or (lambda: datetime.now(UTC))

    def create_session(self, operation_id: str) -> StoredRankingSession:
        catalog = self.catalog_registry.current()
        player_order = [player.id for player in catalog.all()]
        self.shuffler(player_order)
        state = start_ranking(
            tuple(player_order),
            target_size=min(50, len(player_order)),
        )
        now = self.clock()
        session = StoredRankingSession(
            id=str(uuid4()),
            catalog_id=catalog.catalog_id,
            player_order=tuple(player_order),
            state=state,
            version=0,
            can_undo=False,
            created_at=now,
            updated_at=now,
            expires_at=now + SESSION_RETENTION,
        )
        return self.repository.create(
            session,
            operation_id=operation_id,
            request_hash=self._request_hash("create"),
        )

    def get_session(self, session_id: str) -> StoredRankingSession:
        return self.repository.get(session_id, now=self.clock())

    def vote(
        self,
        session_id: str,
        outcome: VoteOutcome,
        *,
        operation_id: str,
        expected_version: int,
    ) -> StoredRankingSession:
        now = self.clock()
        return self.repository.vote(
            session_id,
            operation_id=operation_id,
            request_hash=self._request_hash(
                "vote",
                session_id=session_id,
                expected_version=expected_version,
                outcome=outcome.value,
            ),
            expected_version=expected_version,
            outcome=outcome,
            now=now,
            expires_at=now + SESSION_RETENTION,
        )

    def undo(
        self,
        session_id: str,
        *,
        operation_id: str,
        expected_version: int,
    ) -> StoredRankingSession:
        now = self.clock()
        return self.repository.undo(
            session_id,
            operation_id=operation_id,
            request_hash=self._request_hash(
                "undo",
                session_id=session_id,
                expected_version=expected_version,
            ),
            expected_version=expected_version,
            now=now,
            expires_at=now + SESSION_RETENTION,
        )

    def delete_session(self, session_id: str) -> None:
        self.repository.delete(session_id)

    def cleanup_expired(self) -> int:
        return self.repository.cleanup_expired(now=self.clock())

    def catalog_for(self, catalog_id: str) -> PlayerCatalog:
        return self.catalog_registry.get(catalog_id)

    @staticmethod
    def _request_hash(
        operation_type: str,
        **values: object,
    ) -> str:
        payload = json.dumps(
            {"operation_type": operation_type, **values},
            separators=(",", ":"),
            sort_keys=True,
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()


__all__ = [
    "CorruptSessionError",
    "IdempotencyConflictError",
    "NothingToUndoError",
    "RankingCompleteError",
    "RankingService",
    "SessionExpiredError",
    "SessionNotFoundError",
    "StaleSessionError",
]
