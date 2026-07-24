from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import pytest
from scripts.testing.build_e2e_catalog import build_catalog
from sqlalchemy import inspect

from blind50.application.ports.session_repository import SessionNotFoundError
from blind50.application.ranking_service import RankingService
from blind50.cli.cleanup import cleanup_expired_sessions
from blind50.cli.migrate import migrate_database
from blind50.infrastructure.catalog.json_catalog_registry import (
    JsonCatalogRegistry,
)
from blind50.infrastructure.persistence.database import Database
from blind50.infrastructure.persistence.sql_session_repository import (
    SqlSessionRepository,
)
from blind50.infrastructure.settings import Settings

CATALOG_ROOT = Path(__file__).resolve().parents[5] / "catalog"


def test_migrate_database_builds_the_schema(tmp_path: Path) -> None:
    database_path = tmp_path / "migrated.sqlite3"
    settings = Settings(
        database_url=f"sqlite:///{database_path}",
        catalog_root=CATALOG_ROOT,
    )

    migrate_database(settings)

    database = Database(settings.database_url)
    try:
        assert set(inspect(database.engine).get_table_names()) == {
            "alembic_version",
            "ranking_operations",
            "ranking_sessions",
            "ranking_votes",
        }
    finally:
        database.dispose()


def test_cleanup_command_deletes_expired_sessions(tmp_path: Path) -> None:
    now = datetime(2026, 7, 23, 12, tzinfo=UTC)
    catalog_root = tmp_path / "catalog"
    build_catalog(catalog_root)
    settings = Settings(
        database_url=f"sqlite:///{tmp_path / 'cleanup.sqlite3'}",
        catalog_root=catalog_root,
    )
    migrate_database(settings)
    database = Database(settings.database_url)
    service = RankingService(
        JsonCatalogRegistry(catalog_root),
        SqlSessionRepository(database.session_factory),
        clock=lambda: now,
        shuffler=lambda _: None,
    )
    created = service.create_session(str(uuid4()))

    deleted = cleanup_expired_sessions(
        settings,
        now=now + timedelta(days=91),
    )

    assert deleted == 1
    with pytest.raises(SessionNotFoundError, match=created.id):
        service.get_session(created.id)
    database.dispose()
