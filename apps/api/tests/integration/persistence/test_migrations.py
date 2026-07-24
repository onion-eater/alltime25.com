from __future__ import annotations

from pathlib import Path

from sqlalchemy import inspect, text

from blind50.infrastructure.persistence.database import Database


def test_upgrade_builds_transactional_schema_on_empty_database(
    tmp_path: Path,
) -> None:
    database = Database(f"sqlite:///{tmp_path / 'empty.sqlite3'}")

    database.upgrade_schema()
    database.upgrade_schema()

    assert set(inspect(database.engine).get_table_names()) == {
        "alembic_version",
        "ranking_operations",
        "ranking_sessions",
        "ranking_votes",
    }
    with database.engine.connect() as connection:
        assert (
            connection.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar_one()
            == "20260724_0002"
        )
    columns = {
        column["name"]
        for column in inspect(database.engine).get_columns("ranking_sessions")
    }
    assert {"preset", "identity_mode"} <= columns
    database.dispose()
