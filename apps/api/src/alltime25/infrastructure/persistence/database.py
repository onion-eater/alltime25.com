from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

MIGRATIONS_PATH = Path(__file__).resolve().parent / "migrations"


class Database:
    def __init__(self, database_url: str) -> None:
        self.database_url = database_url
        connect_args = (
            {"check_same_thread": False} if database_url.startswith("sqlite") else {}
        )
        self.engine: Engine = create_engine(
            database_url,
            connect_args=connect_args,
            pool_pre_ping=True,
        )
        if database_url.startswith("sqlite"):
            event.listen(
                self.engine,
                "connect",
                self._enable_sqlite_foreign_keys,
            )
        self.session_factory = sessionmaker(
            bind=self.engine,
            class_=Session,
            expire_on_commit=False,
        )

    def upgrade_schema(self) -> None:
        configuration = Config()
        configuration.set_main_option(
            "script_location",
            str(MIGRATIONS_PATH),
        )
        configuration.set_main_option(
            "sqlalchemy.url",
            self.database_url,
        )
        with self.engine.begin() as connection:
            configuration.attributes["connection"] = connection
            command.upgrade(configuration, "head")

    def dispose(self) -> None:
        self.engine.dispose()

    @staticmethod
    def _enable_sqlite_foreign_keys(
        database_connection: object,
        _: object,
    ) -> None:
        cursor = database_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
