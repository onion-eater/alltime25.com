from __future__ import annotations

from fastapi import APIRouter

from blind50.api.routes.health import router as health_router
from blind50.api.routes.sessions import router as sessions_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health_router)
api_router.include_router(sessions_router)
