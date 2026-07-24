# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS web-build
WORKDIR /build/apps/web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
COPY apps/web/ ./
RUN npm run build

FROM ghcr.io/astral-sh/uv:0.11.1 AS uv

FROM python:3.12-slim AS runtime
ENV PATH="/app/apps/api/.venv/bin:${PATH}" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1
WORKDIR /app

COPY --from=uv /uv /uvx /usr/local/bin/
COPY apps/api/pyproject.toml apps/api/uv.lock ./apps/api/
RUN uv sync --project apps/api --frozen --no-dev --no-install-project

COPY apps/api/src/ ./apps/api/src/
RUN uv sync --project apps/api --frozen --no-dev

COPY catalog/ ./catalog/
COPY --from=web-build /build/apps/web/dist/ ./apps/web/dist/
COPY scripts/container-entrypoint.sh ./scripts/container-entrypoint.sh

RUN groupadd --system blind50 \
    && useradd --system --gid blind50 --home-dir /app blind50 \
    && chmod 0555 /app/scripts/container-entrypoint.sh

USER blind50
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=3)"]

ENTRYPOINT ["/app/scripts/container-entrypoint.sh"]
