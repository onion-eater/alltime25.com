from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from blind50.api.middleware import (
    BrowserSecurityMiddleware,
    configure_request_logging,
)
from blind50.api.router import api_router
from blind50.application.ranking_service import RankingService
from blind50.infrastructure.catalog.json_catalog_registry import (
    JsonCatalogRegistry,
)
from blind50.infrastructure.persistence.database import Database
from blind50.infrastructure.persistence.sql_session_repository import (
    SqlSessionRepository,
)
from blind50.infrastructure.settings import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or Settings()
    database = Database(resolved_settings.database_url)
    catalog_registry = JsonCatalogRegistry(
        resolved_settings.catalog_root,
        resolved_settings.current_catalog_id,
    )
    repository = SqlSessionRepository(database.session_factory)
    ranking_service = RankingService(catalog_registry, repository)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        if resolved_settings.environment_name == "development":
            database.upgrade_schema()
        yield
        database.dispose()

    application = FastAPI(
        title="AllTime 25 API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url=(
            "/docs" if resolved_settings.environment_name == "development" else None
        ),
        redoc_url=None,
    )
    application.state.ranking_service = ranking_service
    application.state.database = database
    configure_request_logging(resolved_settings.log_level)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[resolved_settings.allowed_origin],
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Content-Type"],
    )
    application.add_middleware(
        BrowserSecurityMiddleware,
        allowed_origin=resolved_settings.allowed_origin,
    )
    application.include_router(api_router)
    application.mount(
        "/assets/catalogs",
        StaticFiles(directory=(resolved_settings.catalog_root / "assets" / "catalogs")),
        name="player-images",
    )
    web_dist_root = resolved_settings.web_dist_root.resolve()
    web_assets = web_dist_root / "assets"
    web_index = web_dist_root / "index.html"
    if web_assets.is_dir() and web_index.is_file():
        application.mount(
            "/assets",
            StaticFiles(directory=web_assets),
            name="web-assets",
        )

        @application.get("/{path:path}", include_in_schema=False)
        def serve_spa(path: str) -> FileResponse:
            if path.startswith(("api/", "docs", "redoc", "openapi.json")):
                raise HTTPException(status_code=404)
            requested = (web_dist_root / path).resolve()
            if path and requested.is_relative_to(web_dist_root) and requested.is_file():
                return FileResponse(requested)
            return FileResponse(web_index)

    return application


app = create_app()
