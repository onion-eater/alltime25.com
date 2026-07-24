from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from fastapi.responses import JSONResponse

from blind50.api.dependencies import get_ranking_service
from blind50.api.schemas.sessions import (
    ApiErrorResponse,
    CreateSessionRequest,
    SessionResponse,
    UndoRequest,
    VoteRequest,
    build_session_response,
)
from blind50.application.ranking_service import (
    CorruptSessionError,
    IdempotencyConflictError,
    NothingToUndoError,
    RankingCompleteError,
    RankingService,
    SessionExpiredError,
    SessionNotFoundError,
    StaleSessionError,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])
ServiceDependency = Annotated[RankingService, Depends(get_ranking_service)]
ERROR_RESPONSE = {"model": ApiErrorResponse}


@router.post(
    "",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
    responses={409: ERROR_RESPONSE},
)
def create_session(
    request: CreateSessionRequest,
    service: ServiceDependency,
) -> SessionResponse | JSONResponse:
    try:
        session = service.create_session(
            str(request.operation_id),
            preset=request.preset,
            identity_mode=request.identity_mode,
        )
    except IdempotencyConflictError as error:
        return _error(
            status.HTTP_409_CONFLICT,
            "idempotency_conflict",
            str(error),
            error.current_version,
        )
    return build_session_response(
        session,
        service.catalog_for(session.catalog_id),
    )


@router.get(
    "/{session_id}",
    response_model=SessionResponse,
    responses={
        404: ERROR_RESPONSE,
        410: ERROR_RESPONSE,
        500: ERROR_RESPONSE,
    },
)
def get_session(
    session_id: str,
    service: ServiceDependency,
) -> SessionResponse | JSONResponse:
    try:
        session = service.get_session(session_id)
    except SessionNotFoundError:
        return _error(404, "session_not_found", "Session not found.")
    except SessionExpiredError:
        return _error(410, "session_expired", "Session expired.")
    except CorruptSessionError:
        return _error(
            500,
            "corrupt_session",
            "The saved ranking could not be restored.",
        )
    return build_session_response(
        session,
        service.catalog_for(session.catalog_id),
    )


@router.post(
    "/{session_id}/votes",
    response_model=SessionResponse,
    responses={
        404: ERROR_RESPONSE,
        409: ERROR_RESPONSE,
        410: ERROR_RESPONSE,
        500: ERROR_RESPONSE,
    },
)
def vote(
    session_id: str,
    request: VoteRequest,
    service: ServiceDependency,
) -> SessionResponse | JSONResponse:
    try:
        session = service.vote(
            session_id,
            request.outcome,
            operation_id=str(request.operation_id),
            expected_version=request.expected_version,
        )
    except SessionNotFoundError:
        return _error(404, "session_not_found", "Session not found.")
    except SessionExpiredError:
        return _error(410, "session_expired", "Session expired.")
    except IdempotencyConflictError as error:
        return _error(
            409,
            "idempotency_conflict",
            str(error),
            error.current_version,
        )
    except StaleSessionError as error:
        return _error(
            409,
            "stale_session",
            str(error),
            error.current_version,
        )
    except RankingCompleteError as error:
        return _error(
            409,
            "ranking_complete",
            str(error),
            error.current_version,
        )
    except CorruptSessionError:
        return _error(
            500,
            "corrupt_session",
            "The saved ranking could not be restored.",
        )
    return build_session_response(
        session,
        service.catalog_for(session.catalog_id),
    )


@router.post(
    "/{session_id}/undo",
    response_model=SessionResponse,
    responses={
        404: ERROR_RESPONSE,
        409: ERROR_RESPONSE,
        410: ERROR_RESPONSE,
        500: ERROR_RESPONSE,
    },
)
def undo(
    session_id: str,
    request: UndoRequest,
    service: ServiceDependency,
) -> SessionResponse | JSONResponse:
    try:
        session = service.undo(
            session_id,
            operation_id=str(request.operation_id),
            expected_version=request.expected_version,
        )
    except SessionNotFoundError:
        return _error(404, "session_not_found", "Session not found.")
    except SessionExpiredError:
        return _error(410, "session_expired", "Session expired.")
    except IdempotencyConflictError as error:
        return _error(
            409,
            "idempotency_conflict",
            str(error),
            error.current_version,
        )
    except StaleSessionError as error:
        return _error(
            409,
            "stale_session",
            str(error),
            error.current_version,
        )
    except NothingToUndoError as error:
        return _error(
            409,
            "nothing_to_undo",
            str(error),
            error.current_version,
        )
    except CorruptSessionError:
        return _error(
            500,
            "corrupt_session",
            "The saved ranking could not be restored.",
        )
    return build_session_response(
        session,
        service.catalog_for(session.catalog_id),
    )


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: str,
    service: ServiceDependency,
) -> Response:
    service.delete_session(session_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _error(
    status_code: int,
    code: str,
    message: str,
    current_version: int | None = None,
) -> JSONResponse:
    body = ApiErrorResponse(
        code=code,
        message=message,
        current_version=current_version,
    )
    return JSONResponse(
        status_code=status_code,
        content=body.model_dump(mode="json"),
    )
