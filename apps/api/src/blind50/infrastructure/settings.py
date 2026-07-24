from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPOSITORY_ROOT = Path(__file__).resolve().parents[5]
DEFAULT_CATALOG_ROOT = REPOSITORY_ROOT / "catalog"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="BLIND50_",
        env_file=".env",
        extra="ignore",
    )

    database_url: str = "sqlite:///./blind50.sqlite3"
    catalog_root: Path = DEFAULT_CATALOG_ROOT
    current_catalog_id: str | None = None
    allowed_origin: str = "http://127.0.0.1:5173"
    log_level: str = "INFO"
    environment_name: str = "development"
    web_dist_root: Path = REPOSITORY_ROOT / "apps" / "web" / "dist"
