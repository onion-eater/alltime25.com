from __future__ import annotations

from fastapi import Request

from blind50.application.ranking_service import RankingService


def get_ranking_service(request: Request) -> RankingService:
    service: RankingService = request.app.state.ranking_service
    return service
