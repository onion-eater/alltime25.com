from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from blind50.api.dependencies import get_ranking_service
from blind50.application.ranking_service import RankingService

router = APIRouter(tags=["health"])
ServiceDependency = Annotated[RankingService, Depends(get_ranking_service)]


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
def ready(service: ServiceDependency) -> dict[str, str]:
    try:
        service.repository.ping()
        catalog = service.catalog_registry.current()
        if not catalog.all() or not catalog.assets_ready():
            raise RuntimeError("The current catalog is empty.")
        for pool_size in (25, 50, 100):
            if len(catalog.pool(pool_size)) != pool_size:
                raise RuntimeError("The current catalog is missing a mode pool.")
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail="Service is not ready.",
        ) from error
    return {"status": "ready"}
