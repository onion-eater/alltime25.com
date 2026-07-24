from __future__ import annotations

import json
from datetime import UTC, datetime

from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from blind50.application.ports.session_repository import (
    CorruptSessionError,
    IdempotencyConflictError,
    NothingToUndoError,
    RankingCompleteError,
    SessionExpiredError,
    SessionNotFoundError,
    StaleSessionError,
    StoredRankingSession,
)
from blind50.domain.ranking import (
    STATE_SCHEMA_VERSION,
    RankingState,
    VoteOutcome,
    apply_vote,
)
from blind50.infrastructure.persistence.models import (
    RankingOperationRecord,
    RankingSessionRecord,
    RankingVoteRecord,
)


class _ConcurrentWrite(RuntimeError):
    pass


class SqlSessionRepository:
    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self.session_factory = session_factory

    def create(
        self,
        session: StoredRankingSession,
        *,
        operation_id: str,
        request_hash: str,
    ) -> StoredRankingSession:
        try:
            with self.session_factory.begin() as database:
                existing = database.get(RankingOperationRecord, operation_id)
                if existing is not None:
                    return self._resolve_operation(
                        database,
                        existing,
                        operation_type="create",
                        session_id=None,
                        request_hash=request_hash,
                    )
                database.add(self._to_record(session))
                database.flush()
                database.add(
                    self._operation_record(
                        operation_id=operation_id,
                        session_id=session.id,
                        operation_type="create",
                        request_hash=request_hash,
                        expected_version=None,
                        result=session,
                        now=session.created_at,
                    )
                )
            return session
        except IntegrityError:
            return self._resolve_retry(
                operation_id=operation_id,
                operation_type="create",
                session_id=None,
                request_hash=request_hash,
            )

    def get(
        self,
        session_id: str,
        *,
        now: datetime,
    ) -> StoredRankingSession:
        with self.session_factory() as database:
            record = database.get(RankingSessionRecord, session_id)
            if record is None:
                raise SessionNotFoundError(session_id)
            self._ensure_not_expired(record, now)
            return self._from_record(database, record)

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
    ) -> StoredRankingSession:
        try:
            return self._vote_once(
                session_id=session_id,
                operation_id=operation_id,
                request_hash=request_hash,
                expected_version=expected_version,
                outcome=outcome,
                now=now,
                expires_at=expires_at,
            )
        except _ConcurrentWrite:
            return self._resolve_retry(
                operation_id=operation_id,
                operation_type="vote",
                session_id=session_id,
                request_hash=request_hash,
            )
        except IntegrityError:
            return self._resolve_retry(
                operation_id=operation_id,
                operation_type="vote",
                session_id=session_id,
                request_hash=request_hash,
            )

    def undo(
        self,
        session_id: str,
        *,
        operation_id: str,
        request_hash: str,
        expected_version: int,
        now: datetime,
        expires_at: datetime,
    ) -> StoredRankingSession:
        try:
            return self._undo_once(
                session_id=session_id,
                operation_id=operation_id,
                request_hash=request_hash,
                expected_version=expected_version,
                now=now,
                expires_at=expires_at,
            )
        except _ConcurrentWrite:
            return self._resolve_retry(
                operation_id=operation_id,
                operation_type="undo",
                session_id=session_id,
                request_hash=request_hash,
            )
        except IntegrityError:
            return self._resolve_retry(
                operation_id=operation_id,
                operation_type="undo",
                session_id=session_id,
                request_hash=request_hash,
            )

    def delete(self, session_id: str) -> None:
        with self.session_factory.begin() as database:
            record = database.get(RankingSessionRecord, session_id)
            if record is not None:
                database.delete(record)

    def cleanup_expired(self, *, now: datetime) -> int:
        with self.session_factory.begin() as database:
            result = database.execute(
                delete(RankingSessionRecord).where(
                    RankingSessionRecord.expires_at <= now
                )
            )
            return result.rowcount or 0

    def ping(self) -> None:
        with self.session_factory() as database:
            database.execute(select(1)).scalar_one()

    def _vote_once(
        self,
        *,
        session_id: str,
        operation_id: str,
        request_hash: str,
        expected_version: int,
        outcome: VoteOutcome,
        now: datetime,
        expires_at: datetime,
    ) -> StoredRankingSession:
        with self.session_factory.begin() as database:
            existing = database.get(RankingOperationRecord, operation_id)
            if existing is not None:
                return self._resolve_operation(
                    database,
                    existing,
                    operation_type="vote",
                    session_id=session_id,
                    request_hash=request_hash,
                )

            record = self._required_record(database, session_id)
            self._ensure_not_expired(record, now)
            state = self._load_state(record.state_json, session_id)
            if state.is_complete or record.version != expected_version:
                committed_retry = database.scalar(
                    select(RankingOperationRecord).where(
                        RankingOperationRecord.operation_id == operation_id
                    )
                )
                if committed_retry is not None:
                    return self._resolve_operation(
                        database,
                        committed_retry,
                        operation_type="vote",
                        session_id=session_id,
                        request_hash=request_hash,
                    )
                if state.is_complete:
                    raise RankingCompleteError(record.version)
                raise StaleSessionError(record.version)

            updated_state = apply_vote(state, outcome)
            resulting_version = expected_version + 1
            result = StoredRankingSession(
                id=record.id,
                catalog_id=record.catalog_id,
                player_order=self._load_player_order(record),
                state=updated_state,
                version=resulting_version,
                can_undo=True,
                created_at=self._as_utc(record.created_at),
                updated_at=now,
                expires_at=expires_at,
            )
            self._compare_and_swap(
                database,
                record.id,
                expected_version=expected_version,
                result=result,
            )
            database.add(
                RankingVoteRecord(
                    session_id=record.id,
                    sequence=resulting_version,
                    operation_id=operation_id,
                    outcome=outcome.value,
                    state_before_json=self._dump_state(state),
                    state_after_json=self._dump_state(updated_state),
                    active=True,
                    created_at=now,
                    undone_at=None,
                )
            )
            database.add(
                self._operation_record(
                    operation_id=operation_id,
                    session_id=record.id,
                    operation_type="vote",
                    request_hash=request_hash,
                    expected_version=expected_version,
                    result=result,
                    now=now,
                )
            )
            return result

    def _undo_once(
        self,
        *,
        session_id: str,
        operation_id: str,
        request_hash: str,
        expected_version: int,
        now: datetime,
        expires_at: datetime,
    ) -> StoredRankingSession:
        with self.session_factory.begin() as database:
            existing = database.get(RankingOperationRecord, operation_id)
            if existing is not None:
                return self._resolve_operation(
                    database,
                    existing,
                    operation_type="undo",
                    session_id=session_id,
                    request_hash=request_hash,
                )

            record = self._required_record(database, session_id)
            self._ensure_not_expired(record, now)
            if record.version != expected_version:
                committed_retry = database.scalar(
                    select(RankingOperationRecord).where(
                        RankingOperationRecord.operation_id == operation_id
                    )
                )
                if committed_retry is not None:
                    return self._resolve_operation(
                        database,
                        committed_retry,
                        operation_type="undo",
                        session_id=session_id,
                        request_hash=request_hash,
                    )
                raise StaleSessionError(record.version)
            vote = database.scalars(
                select(RankingVoteRecord)
                .where(
                    RankingVoteRecord.session_id == session_id,
                    RankingVoteRecord.active.is_(True),
                )
                .order_by(RankingVoteRecord.sequence.desc())
                .limit(1)
            ).one_or_none()
            if vote is None:
                raise NothingToUndoError(record.version)

            restored_state = self._load_state(
                vote.state_before_json,
                session_id,
            )
            vote.active = False
            vote.undone_at = now
            database.flush()
            can_undo = (
                database.scalar(
                    select(RankingVoteRecord.id)
                    .where(
                        RankingVoteRecord.session_id == session_id,
                        RankingVoteRecord.active.is_(True),
                    )
                    .limit(1)
                )
                is not None
            )
            resulting_version = expected_version + 1
            result = StoredRankingSession(
                id=record.id,
                catalog_id=record.catalog_id,
                player_order=self._load_player_order(record),
                state=restored_state,
                version=resulting_version,
                can_undo=can_undo,
                created_at=self._as_utc(record.created_at),
                updated_at=now,
                expires_at=expires_at,
            )
            self._compare_and_swap(
                database,
                record.id,
                expected_version=expected_version,
                result=result,
            )
            database.add(
                self._operation_record(
                    operation_id=operation_id,
                    session_id=record.id,
                    operation_type="undo",
                    request_hash=request_hash,
                    expected_version=expected_version,
                    result=result,
                    now=now,
                )
            )
            return result

    def _compare_and_swap(
        self,
        database: Session,
        session_id: str,
        *,
        expected_version: int,
        result: StoredRankingSession,
    ) -> None:
        update_result = database.execute(
            update(RankingSessionRecord)
            .where(
                RankingSessionRecord.id == session_id,
                RankingSessionRecord.version == expected_version,
            )
            .values(
                state_json=self._dump_state(result.state),
                state_schema_version=STATE_SCHEMA_VERSION,
                version=result.version,
                status=("complete" if result.state.is_complete else "active"),
                updated_at=result.updated_at,
                expires_at=result.expires_at,
            )
        )
        if update_result.rowcount != 1:
            raise _ConcurrentWrite(session_id)

    def _resolve_retry(
        self,
        *,
        operation_id: str,
        operation_type: str,
        session_id: str | None,
        request_hash: str,
    ) -> StoredRankingSession:
        with self.session_factory() as database:
            operation = database.get(RankingOperationRecord, operation_id)
            if operation is not None:
                return self._resolve_operation(
                    database,
                    operation,
                    operation_type=operation_type,
                    session_id=session_id,
                    request_hash=request_hash,
                )
            if session_id is None:
                raise RuntimeError(
                    "The create operation failed before it was persisted."
                )
            record = database.get(RankingSessionRecord, session_id)
            if record is None:
                raise SessionNotFoundError(session_id)
            raise StaleSessionError(record.version)

    def _resolve_operation(
        self,
        database: Session,
        operation: RankingOperationRecord,
        *,
        operation_type: str,
        session_id: str | None,
        request_hash: str,
    ) -> StoredRankingSession:
        record = database.get(
            RankingSessionRecord,
            operation.session_id,
        )
        current_version = record.version if record is not None else None
        if (
            operation.operation_type != operation_type
            or operation.request_hash != request_hash
            or (session_id is not None and operation.session_id != session_id)
        ):
            raise IdempotencyConflictError(current_version)
        if record is None:
            raise SessionNotFoundError(operation.session_id)
        state = self._load_state(
            operation.result_state_json,
            operation.session_id,
        )
        return StoredRankingSession(
            id=record.id,
            catalog_id=record.catalog_id,
            player_order=self._load_player_order(record),
            state=state,
            version=operation.resulting_version,
            can_undo=operation.result_can_undo,
            created_at=self._as_utc(record.created_at),
            updated_at=self._as_utc(record.updated_at),
            expires_at=self._as_utc(record.expires_at),
        )

    def _from_record(
        self,
        database: Session,
        record: RankingSessionRecord,
    ) -> StoredRankingSession:
        can_undo = (
            database.scalar(
                select(RankingVoteRecord.id)
                .where(
                    RankingVoteRecord.session_id == record.id,
                    RankingVoteRecord.active.is_(True),
                )
                .limit(1)
            )
            is not None
        )
        return StoredRankingSession(
            id=record.id,
            catalog_id=record.catalog_id,
            player_order=self._load_player_order(record),
            state=self._load_state(record.state_json, record.id),
            version=record.version,
            can_undo=can_undo,
            created_at=self._as_utc(record.created_at),
            updated_at=self._as_utc(record.updated_at),
            expires_at=self._as_utc(record.expires_at),
        )

    @staticmethod
    def _required_record(
        database: Session,
        session_id: str,
    ) -> RankingSessionRecord:
        record = database.get(RankingSessionRecord, session_id)
        if record is None:
            raise SessionNotFoundError(session_id)
        return record

    @classmethod
    def _ensure_not_expired(
        cls,
        record: RankingSessionRecord,
        now: datetime,
    ) -> None:
        if cls._as_utc(record.expires_at) <= cls._as_utc(now):
            raise SessionExpiredError(record.id)

    @staticmethod
    def _operation_record(
        *,
        operation_id: str,
        session_id: str,
        operation_type: str,
        request_hash: str,
        expected_version: int | None,
        result: StoredRankingSession,
        now: datetime,
    ) -> RankingOperationRecord:
        return RankingOperationRecord(
            operation_id=operation_id,
            session_id=session_id,
            operation_type=operation_type,
            request_hash=request_hash,
            expected_version=expected_version,
            resulting_version=result.version,
            result_state_json=SqlSessionRepository._dump_state(result.state),
            result_can_undo=result.can_undo,
            created_at=now,
        )

    @staticmethod
    def _to_record(
        session: StoredRankingSession,
    ) -> RankingSessionRecord:
        return RankingSessionRecord(
            id=session.id,
            catalog_id=session.catalog_id,
            player_order_json=json.dumps(
                session.player_order,
                separators=(",", ":"),
            ),
            state_json=SqlSessionRepository._dump_state(session.state),
            state_schema_version=STATE_SCHEMA_VERSION,
            version=session.version,
            status=("complete" if session.state.is_complete else "active"),
            created_at=session.created_at,
            updated_at=session.updated_at,
            expires_at=session.expires_at,
        )

    @staticmethod
    def _load_player_order(
        record: RankingSessionRecord,
    ) -> tuple[str, ...]:
        try:
            values = json.loads(record.player_order_json)
        except (json.JSONDecodeError, TypeError) as error:
            raise CorruptSessionError(record.id) from error
        if (
            not isinstance(values, list)
            or not values
            or any(not isinstance(value, str) for value in values)
            or len(values) != len(set(values))
        ):
            raise CorruptSessionError(record.id)
        return tuple(values)

    @staticmethod
    def _load_state(payload: str, session_id: str) -> RankingState:
        try:
            return RankingState.from_dict(json.loads(payload))
        except (json.JSONDecodeError, TypeError, ValueError, KeyError) as error:
            raise CorruptSessionError(session_id) from error

    @staticmethod
    def _dump_state(state: RankingState) -> str:
        return json.dumps(
            state.to_dict(),
            separators=(",", ":"),
            sort_keys=True,
        )

    @staticmethod
    def _as_utc(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)
