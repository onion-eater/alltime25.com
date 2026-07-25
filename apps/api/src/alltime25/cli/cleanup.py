from __future__ import annotations

from datetime import UTC, datetime

from alltime25.infrastructure.persistence.database import Database
from alltime25.infrastructure.persistence.sql_session_repository import (
    SqlSessionRepository,
)
from alltime25.infrastructure.settings import Settings


def cleanup_expired_sessions(
    settings: Settings | None = None,
    *,
    now: datetime | None = None,
) -> int:
    resolved_settings = settings or Settings()
    database = Database(resolved_settings.database_url)
    repository = SqlSessionRepository(database.session_factory)
    try:
        return repository.cleanup_expired(now=now or datetime.now(UTC))
    finally:
        database.dispose()


def main() -> int:
    deleted = cleanup_expired_sessions()
    print(f"Deleted {deleted} expired sessions.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
