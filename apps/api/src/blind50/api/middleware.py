from __future__ import annotations

import json
import logging
import re
from collections.abc import Awaitable, Callable
from time import monotonic

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'self'; "
        "base-uri 'none'; "
        "connect-src 'self'; "
        "form-action 'self'; "
        "frame-ancestors 'none'; "
        "img-src 'self' data:; "
        "object-src 'none'; "
        "script-src 'self'; "
        "style-src 'self'"
    ),
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
}
SESSION_PATH = re.compile(r"(?P<prefix>/sessions/)[^/]+")
REQUEST_LOGGER = logging.getLogger("blind50.request")


def configure_request_logging(
    level: str,
    *,
    logger: logging.Logger = REQUEST_LOGGER,
) -> None:
    logger.setLevel(level.upper())
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(message)s"))
        logger.addHandler(handler)
    logger.propagate = False


def redacted_request_path(path: str) -> str:
    return SESSION_PATH.sub(r"\g<prefix>{session_id}", path)


class BrowserSecurityMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: object, *, allowed_origin: str) -> None:
        super().__init__(app)
        self.allowed_origin = allowed_origin.rstrip("/")

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        started_at = monotonic()
        if self._is_cross_origin_mutation(request):
            response: Response = JSONResponse(
                status_code=403,
                content={
                    "code": "cross_origin_request",
                    "message": "Cross-origin mutations are not allowed.",
                    "current_version": None,
                },
            )
        else:
            response = await call_next(request)
        for name, value in SECURITY_HEADERS.items():
            response.headers.setdefault(name, value)
        REQUEST_LOGGER.info(
            json.dumps(
                {
                    "duration_ms": round((monotonic() - started_at) * 1_000, 2),
                    "method": request.method,
                    "path": redacted_request_path(request.url.path),
                    "status": response.status_code,
                },
                sort_keys=True,
            )
        )
        return response

    def _is_cross_origin_mutation(self, request: Request) -> bool:
        if request.method not in {
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
        } or not request.url.path.startswith("/api/"):
            return False
        origin = request.headers.get("origin")
        if origin is not None and origin.rstrip("/") != self.allowed_origin:
            return True
        return request.headers.get("sec-fetch-site") == "cross-site"
