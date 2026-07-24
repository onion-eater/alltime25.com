from __future__ import annotations

import os
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Barrier
from uuid import uuid4

import pytest
from scripts.testing.build_e2e_catalog import CATALOG_ID, build_catalog
from sqlalchemy import event, func, select
from sqlalchemy.exc import OperationalError

from blind50.application.ports.session_repository import (
    IdempotencyConflictError,
    StaleSessionError,
)
from blind50.application.ranking_service import RankingService
from blind50.domain.ranking import VoteOutcome
from blind50.infrastructure.catalog.json_player_catalog import JsonPlayerCatalog
from blind50.infrastructure.persistence.database import Database
from blind50.infrastructure.persistence.models import (
    RankingOperationRecord,
    RankingSessionRecord,
    RankingVoteRecord,
)
from blind50.infrastructure.persistence.sql_session_repository import (
    SqlSessionRepository,
)

POSTGRES_URL = os.environ.get(
    "BLIND50_TEST_DATABASE_URL",
    "postgresql+psycopg://blind50:blind50@127.0.0.1:55432/blind50_test",
)


class StubCatalogRegistry:
    def __init__(self, catalog: JsonPlayerCatalog) -> None:
        self.catalog = catalog

    def current(self) -> JsonPlayerCatalog:
        return self.catalog

    def get(self, catalog_id: str) -> JsonPlayerCatalog:
        if catalog_id != self.catalog.catalog_id:
            raise LookupError(catalog_id)
        return self.catalog


@pytest.fixture
def postgres_database() -> Iterator[Database]:
    database = Database(POSTGRES_URL)
    try:
        database.upgrade_schema()
    except OperationalError:
        database.dispose()
        pytest.skip("PostgreSQL integration service is unavailable.")

    with database.session_factory.begin() as session:
        session.query(RankingSessionRecord).delete()
    yield database
    with database.session_factory.begin() as session:
        session.query(RankingSessionRecord).delete()
    database.dispose()


@pytest.fixture
def postgres_service(
    postgres_database: Database,
    tmp_path: Path,
) -> RankingService:
    catalog_root = tmp_path / "catalog"
    build_catalog(catalog_root)
    catalog = JsonPlayerCatalog(
        catalog_root / "data" / "catalogs" / CATALOG_ID / "players.json",
        catalog_root / "assets" / "catalogs" / CATALOG_ID / "players",
    )
    return RankingService(
        StubCatalogRegistry(catalog),
        SqlSessionRepository(postgres_database.session_factory),
        shuffler=lambda _: None,
    )


def new_operation_id() -> str:
    return str(uuid4())


def test_two_simultaneous_votes_accept_exactly_one(
    postgres_service: RankingService,
) -> None:
    created = postgres_service.create_session(new_operation_id())
    barrier = Barrier(2)

    def submit(outcome: VoteOutcome) -> object:
        barrier.wait()
        return postgres_service.vote(
            created.id,
            outcome,
            operation_id=new_operation_id(),
            expected_version=0,
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(submit, VoteOutcome.BETTER),
            executor.submit(submit, VoteOutcome.WORSE),
        ]
    results = []
    errors = []
    for future in futures:
        try:
            results.append(future.result())
        except Exception as error:
            errors.append(error)

    assert len(results) == 1
    assert results[0].version == 1
    assert len(errors) == 1
    assert isinstance(errors[0], StaleSessionError)
    assert errors[0].current_version == 1


def test_concurrent_duplicate_operation_returns_one_result(
    postgres_service: RankingService,
) -> None:
    created = postgres_service.create_session(new_operation_id())
    operation_id = new_operation_id()
    barrier = Barrier(2)

    def submit() -> object:
        barrier.wait()
        return postgres_service.vote(
            created.id,
            VoteOutcome.BETTER,
            operation_id=operation_id,
            expected_version=0,
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: submit(), range(2)))

    assert results[0].version == 1
    assert results[1] == results[0]
    assert postgres_service.get_session(created.id).version == 1


def test_retry_after_committed_response_is_lost(
    postgres_service: RankingService,
) -> None:
    created = postgres_service.create_session(new_operation_id())
    operation_id = new_operation_id()

    first = postgres_service.vote(
        created.id,
        VoteOutcome.TIE,
        operation_id=operation_id,
        expected_version=0,
    )
    retried = postgres_service.vote(
        created.id,
        VoteOutcome.TIE,
        operation_id=operation_id,
        expected_version=0,
    )

    assert retried == first
    assert retried.state.votes_count == 1


def test_duplicate_operation_with_changed_payload_conflicts(
    postgres_service: RankingService,
) -> None:
    created = postgres_service.create_session(new_operation_id())
    operation_id = new_operation_id()
    postgres_service.vote(
        created.id,
        VoteOutcome.BETTER,
        operation_id=operation_id,
        expected_version=0,
    )

    with pytest.raises(IdempotencyConflictError):
        postgres_service.vote(
            created.id,
            VoteOutcome.WORSE,
            operation_id=operation_id,
            expected_version=0,
        )


def test_concurrent_vote_and_undo_do_not_overwrite_each_other(
    postgres_service: RankingService,
) -> None:
    created = postgres_service.create_session(new_operation_id())
    voted = postgres_service.vote(
        created.id,
        VoteOutcome.BETTER,
        operation_id=new_operation_id(),
        expected_version=0,
    )
    barrier = Barrier(2)

    def submit_vote() -> object:
        barrier.wait()
        return postgres_service.vote(
            created.id,
            VoteOutcome.WORSE,
            operation_id=new_operation_id(),
            expected_version=voted.version,
        )

    def submit_undo() -> object:
        barrier.wait()
        return postgres_service.undo(
            created.id,
            operation_id=new_operation_id(),
            expected_version=voted.version,
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(submit_vote),
            executor.submit(submit_undo),
        ]
    successes = []
    errors = []
    for future in futures:
        try:
            successes.append(future.result())
        except Exception as error:
            errors.append(error)

    assert len(successes) == 1
    assert successes[0].version == 2
    assert len(errors) == 1
    assert isinstance(errors[0], StaleSessionError)
    assert postgres_service.get_session(created.id).version == 2


def test_persistence_failure_rolls_back_every_vote_write(
    postgres_database: Database,
    postgres_service: RankingService,
) -> None:
    created = postgres_service.create_session(new_operation_id())

    def fail_operation_insert(
        _connection: object,
        _cursor: object,
        statement: str,
        _parameters: object,
        _context: object,
        _executemany: bool,
    ) -> None:
        if statement.startswith("INSERT INTO ranking_operations"):
            raise RuntimeError("forced persistence failure")

    event.listen(
        postgres_database.engine,
        "before_cursor_execute",
        fail_operation_insert,
    )
    try:
        with pytest.raises(RuntimeError, match="forced"):
            postgres_service.vote(
                created.id,
                VoteOutcome.BETTER,
                operation_id=new_operation_id(),
                expected_version=0,
            )
    finally:
        event.remove(
            postgres_database.engine,
            "before_cursor_execute",
            fail_operation_insert,
        )

    restored = postgres_service.get_session(created.id)
    assert restored.version == 0
    assert restored.state.votes_count == 0
    with postgres_database.session_factory() as session:
        assert (
            session.scalar(
                select(func.count())
                .select_from(RankingVoteRecord)
                .where(RankingVoteRecord.session_id == created.id)
            )
            == 0
        )
        assert (
            session.scalar(
                select(func.count())
                .select_from(RankingOperationRecord)
                .where(RankingOperationRecord.session_id == created.id)
            )
            == 1
        )


def test_expiry_cleanup_cascades_on_postgres(
    postgres_database: Database,
    postgres_service: RankingService,
) -> None:
    now = datetime(2026, 7, 23, tzinfo=UTC)
    postgres_service.clock = lambda: now
    created = postgres_service.create_session(new_operation_id())
    postgres_service.vote(
        created.id,
        VoteOutcome.BETTER,
        operation_id=new_operation_id(),
        expected_version=0,
    )
    postgres_service.clock = lambda: now + timedelta(days=91)

    assert postgres_service.cleanup_expired() == 1
    with postgres_database.session_factory() as session:
        assert session.get(RankingSessionRecord, created.id) is None
        assert (
            session.scalar(
                select(func.count())
                .select_from(RankingVoteRecord)
                .where(RankingVoteRecord.session_id == created.id)
            )
            == 0
        )
        assert (
            session.scalar(
                select(func.count())
                .select_from(RankingOperationRecord)
                .where(RankingOperationRecord.session_id == created.id)
            )
            == 0
        )
