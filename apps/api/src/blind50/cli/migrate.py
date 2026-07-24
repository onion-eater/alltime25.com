from __future__ import annotations

from blind50.infrastructure.persistence.database import Database
from blind50.infrastructure.settings import Settings


def migrate_database(settings: Settings | None = None) -> None:
    resolved_settings = settings or Settings()
    database = Database(resolved_settings.database_url)
    try:
        database.upgrade_schema()
    finally:
        database.dispose()


def main() -> int:
    migrate_database()
    print("Database migration complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
