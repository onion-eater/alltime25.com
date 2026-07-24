from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from blind50.infrastructure.settings import Settings
from blind50.main import create_app

CATALOG_ROOT = Path(__file__).resolve().parents[5] / "catalog"
pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
async def beta_client(tmp_path: Path) -> AsyncIterator[AsyncClient]:
    app = create_app(
        Settings(
            database_url=f"sqlite:///{tmp_path / 'beta.sqlite3'}",
            catalog_root=CATALOG_ROOT,
            environment_name="beta",
            allowed_origin="https://beta.example",
        )
    )
    async with (
        app.router.lifespan_context(app),
        AsyncClient(
            transport=ASGITransport(app=app),
            base_url="https://beta.example",
        ) as client,
    ):
        yield client


async def test_interactive_docs_are_disabled_in_beta(
    beta_client: AsyncClient,
) -> None:
    response = await beta_client.get("/docs")

    assert response.status_code == 404


async def test_readiness_rejects_the_development_catalog_without_mode_pools(
    beta_client: AsyncClient,
) -> None:
    response = await beta_client.get("/api/v1/ready")

    assert response.status_code == 503
    assert response.json() == {"detail": "Service is not ready."}
