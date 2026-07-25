from __future__ import annotations

import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient, Response
from scripts.testing.build_e2e_catalog import CATALOG_ID, build_catalog
from sqlalchemy import func, select, update

from alltime25.infrastructure.persistence.models import (
    RankingOperationRecord,
    RankingSessionRecord,
    RankingVoteRecord,
)
from alltime25.infrastructure.settings import Settings
from alltime25.main import create_app

pytestmark = pytest.mark.anyio


@dataclass(frozen=True)
class ApiTestClient:
    http: AsyncClient
    app: FastAPI

    async def get(self, path: str) -> Response:
        return await self.http.get(path)

    async def post(self, path: str, **kwargs: Any) -> Response:
        return await self.http.post(path, **kwargs)

    async def delete(self, path: str) -> Response:
        return await self.http.delete(path)


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
async def client(tmp_path: Path) -> AsyncIterator[ApiTestClient]:
    catalog_root = tmp_path / "catalog"
    build_catalog(catalog_root)
    settings = Settings(
        database_url=f"sqlite:///{tmp_path / 'test.sqlite3'}",
        catalog_root=catalog_root,
        allowed_origin="http://testserver",
    )
    application = create_app(settings)
    transport = ASGITransport(app=application)
    async with (
        application.router.lifespan_context(application),
        AsyncClient(
            transport=transport,
            base_url="http://testserver",
        ) as http,
    ):
        yield ApiTestClient(http=http, app=application)


def operation_id() -> str:
    return str(uuid4())


async def create_session(
    client: ApiTestClient,
    *,
    create_operation_id: str | None = None,
    preset: str | None = None,
    identity_mode: str | None = None,
) -> dict[str, object]:
    payload = {"operation_id": create_operation_id or operation_id()}
    if preset is not None:
        payload["preset"] = preset
    if identity_mode is not None:
        payload["identity_mode"] = identity_mode
    response = await client.post(
        "/api/v1/sessions",
        json=payload,
    )
    assert response.status_code == 201
    return response.json()


async def vote(
    client: ApiTestClient,
    current: dict[str, object],
    outcome: str,
    *,
    vote_operation_id: str | None = None,
    expected_version: int | None = None,
) -> Response:
    return await client.post(
        f"/api/v1/sessions/{current['id']}/votes",
        json={
            "operation_id": vote_operation_id or operation_id(),
            "expected_version": (
                current["version"] if expected_version is None else expected_version
            ),
            "outcome": outcome,
        },
    )


async def undo(
    client: ApiTestClient,
    current: dict[str, object],
    *,
    undo_operation_id: str | None = None,
) -> Response:
    return await client.post(
        f"/api/v1/sessions/{current['id']}/undo",
        json={
            "operation_id": undo_operation_id or operation_id(),
            "expected_version": current["version"],
        },
    )


async def finish_session(
    client: ApiTestClient,
    created: dict[str, object] | None = None,
) -> dict[str, object]:
    current = created or await create_session(client)
    while current["status"] != "complete":
        response = await vote(client, current, "worse")
        assert response.status_code == 200
        current = response.json()
    return current


async def test_health_and_readiness(client: ApiTestClient) -> None:
    health = await client.get("/api/v1/health")
    ready = await client.get("/api/v1/ready")

    assert health.status_code == 200
    assert health.json() == {"status": "ok"}
    assert ready.status_code == 200
    assert ready.json() == {"status": "ready"}


async def test_security_headers_are_present(client: ApiTestClient) -> None:
    response = await client.get("/api/v1/health")

    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert response.headers["permissions-policy"] == (
        "camera=(), microphone=(), geolocation=()"
    )
    assert "default-src 'self'" in response.headers["content-security-policy"]


async def test_cross_origin_mutation_is_rejected(client: ApiTestClient) -> None:
    response = await client.post(
        "/api/v1/sessions",
        headers={"Origin": "https://attacker.example"},
        json={"operation_id": operation_id()},
    )

    assert response.status_code == 403
    assert response.json() == {
        "code": "cross_origin_request",
        "message": "Cross-origin mutations are not allowed.",
        "current_version": None,
    }


async def test_allowed_origin_mutation_succeeds(client: ApiTestClient) -> None:
    response = await client.post(
        "/api/v1/sessions",
        headers={"Origin": "http://testserver"},
        json={"operation_id": operation_id()},
    )

    assert response.status_code == 201


async def test_create_session_defaults_to_top_25_normal(
    client: ApiTestClient,
) -> None:
    body = await create_session(client)

    assert body["status"] == "active"
    assert body["preset"] == "top_25"
    assert body["identity_mode"] == "normal"
    assert body["target_size"] == 25
    assert body["pool_size"] == 50
    assert body["version"] == 0
    assert body["can_undo"] is False
    assert body["catalog_id"] == CATALOG_ID
    assert body["comparison"]["player_a"]["label"] == "Player A"
    assert body["comparison"]["player_b"]["label"] == "Player B"
    assert body["comparison"]["player_a"]["name"]
    assert body["comparison"]["player_a"]["image_url"].startswith("/assets/catalogs/")
    assert "three_pct" in body["comparison"]["player_a"]["regular_season"]
    assert "three_pct" in body["comparison"]["player_a"]["playoffs"]
    assert body["ranking"] is None
    assert len(body["ranking_preview"]) == 1
    assert body["ranking_preview"][0]["rank"] == 1
    assert body["ranking_preview"][0]["players"][0]["name"]
    assert body["ranking_preview"][0]["players"][0]["image_url"].startswith(
        "/assets/catalogs/"
    )


@pytest.mark.parametrize(
    ("preset", "pool_size", "target_size"),
    (
        ("top_10", 25, 10),
        ("top_25", 50, 25),
        ("top_50", 100, 50),
    ),
)
async def test_create_session_maps_each_preset_to_fixed_sizes(
    client: ApiTestClient,
    preset: str,
    pool_size: int,
    target_size: int,
) -> None:
    body = await create_session(client, preset=preset)

    assert body["preset"] == preset
    assert body["pool_size"] == pool_size
    assert body["target_size"] == target_size


async def test_blind_active_response_omits_identity_fields(
    client: ApiTestClient,
) -> None:
    body = await create_session(client, identity_mode="blind")

    serialized = json.dumps(
        {
            "comparison": body["comparison"],
            "ranking_preview": body["ranking_preview"],
        }
    ).lower()
    for forbidden in (
        '"name"',
        '"id"',
        "image",
        ".jpg",
        ".webp",
        "jordan",
        "provider",
    ):
        assert forbidden not in serialized
    assert body["ranking_preview"][0]["players"][0]["code"].startswith("#")


async def test_active_ranking_preview_preserves_ties_and_skipped_ranks(
    client: ApiTestClient,
) -> None:
    created = await create_session(client)
    tied = (await vote(client, created, "tie")).json()

    assert tied["ranking"] is None
    assert tied["ranking_preview"][0]["rank"] == 1
    assert len(tied["ranking_preview"][0]["players"]) == 2


async def test_create_operation_id_cannot_be_reused_for_another_mode(
    client: ApiTestClient,
) -> None:
    create_id = operation_id()
    await create_session(
        client,
        create_operation_id=create_id,
        preset="top_10",
        identity_mode="blind",
    )

    conflict = await client.post(
        "/api/v1/sessions",
        json={
            "operation_id": create_id,
            "preset": "top_50",
            "identity_mode": "normal",
        },
    )

    assert conflict.status_code == 409
    assert conflict.json()["code"] == "idempotency_conflict"


async def test_create_is_idempotent(client: ApiTestClient) -> None:
    create_id = operation_id()

    first = await create_session(client, create_operation_id=create_id)
    retried = await create_session(client, create_operation_id=create_id)

    assert retried == first


async def test_vote_changes_comparison_and_persists_after_reload(
    client: ApiTestClient,
) -> None:
    created = await create_session(client)

    voted_response = await vote(client, created, "better")
    reloaded_response = await client.get(f"/api/v1/sessions/{created['id']}")

    assert voted_response.status_code == 200
    assert reloaded_response.status_code == 200
    assert reloaded_response.json() == voted_response.json()
    assert reloaded_response.json()["version"] == 1
    assert reloaded_response.json()["can_undo"] is True
    assert reloaded_response.json()["progress"]["votes"] == 1


async def test_retried_vote_returns_original_result_without_double_apply(
    client: ApiTestClient,
) -> None:
    created = await create_session(client)
    vote_id = operation_id()

    first = await vote(
        client,
        created,
        "better",
        vote_operation_id=vote_id,
    )
    retried = await vote(
        client,
        created,
        "better",
        vote_operation_id=vote_id,
    )

    assert first.status_code == 200
    assert retried.status_code == 200
    assert retried.json() == first.json()
    reloaded = await client.get(f"/api/v1/sessions/{created['id']}")
    assert reloaded.json()["version"] == 1


async def test_operation_id_reuse_with_different_payload_conflicts(
    client: ApiTestClient,
) -> None:
    created = await create_session(client)
    vote_id = operation_id()
    first = await vote(
        client,
        created,
        "better",
        vote_operation_id=vote_id,
    )

    conflict = await vote(
        client,
        created,
        "worse",
        vote_operation_id=vote_id,
    )

    assert first.status_code == 200
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "idempotency_conflict"
    assert conflict.json()["current_version"] == 1


async def test_stale_session_conflicts_without_overwriting(
    client: ApiTestClient,
) -> None:
    created = await create_session(client)
    first = await vote(client, created, "better")

    stale = await vote(client, created, "worse")

    assert first.status_code == 200
    assert stale.status_code == 409
    assert stale.json()["code"] == "stale_session"
    assert stale.json()["current_version"] == 1
    reloaded = await client.get(f"/api/v1/sessions/{created['id']}")
    assert reloaded.json() == first.json()


async def test_undo_restores_previous_comparison(
    client: ApiTestClient,
) -> None:
    created = await create_session(client)
    voted = (await vote(client, created, "tie")).json()

    restored = await undo(client, voted)

    assert restored.status_code == 200
    assert restored.json()["comparison"] == created["comparison"]
    assert restored.json()["progress"]["votes"] == 0
    assert restored.json()["version"] == 2
    assert restored.json()["can_undo"] is False


async def test_retried_undo_does_not_undo_multiple_votes(
    client: ApiTestClient,
) -> None:
    created = await create_session(client)
    voted_once = (await vote(client, created, "better")).json()
    voted_twice = (await vote(client, voted_once, "worse")).json()
    undo_id = operation_id()

    first = await undo(
        client,
        voted_twice,
        undo_operation_id=undo_id,
    )
    retried = await undo(
        client,
        voted_twice,
        undo_operation_id=undo_id,
    )

    assert first.status_code == 200
    assert retried.json() == first.json()
    assert retried.json()["progress"]["votes"] == 1


async def test_vote_after_undo_creates_a_new_active_branch(
    client: ApiTestClient,
) -> None:
    created = await create_session(client)
    first_vote = (await vote(client, created, "better")).json()
    second_vote = (await vote(client, first_vote, "worse")).json()
    restored = (await undo(client, second_vote)).json()

    branched = await vote(client, restored, "tie")

    assert branched.status_code == 200
    assert branched.json()["version"] == 4
    assert branched.json()["progress"]["votes"] == 2
    database = client.app.state.database
    with database.session_factory() as session:
        active_count = session.scalar(
            select(func.count())
            .select_from(RankingVoteRecord)
            .where(
                RankingVoteRecord.session_id == created["id"],
                RankingVoteRecord.active.is_(True),
            )
        )
        undone_count = session.scalar(
            select(func.count())
            .select_from(RankingVoteRecord)
            .where(
                RankingVoteRecord.session_id == created["id"],
                RankingVoteRecord.active.is_(False),
            )
        )
    assert active_count == 2
    assert undone_count == 1


async def test_undo_without_vote_returns_structured_conflict(
    client: ApiTestClient,
) -> None:
    created = await create_session(client)

    response = await undo(client, created)

    assert response.status_code == 409
    assert response.json()["code"] == "nothing_to_undo"
    assert response.json()["current_version"] == 0


async def test_completed_response_reveals_names_images_and_ranks(
    client: ApiTestClient,
) -> None:
    completed = await finish_session(client)

    assert completed["status"] == "complete"
    assert completed["comparison"] is None
    assert completed["ranking_preview"] is None
    assert len(completed["ranking"]) == 25
    first_player = completed["ranking"][0]["players"][0]
    assert first_player["name"]
    assert first_player["image_url"].startswith("/assets/catalogs/")
    assert completed["ranking"][0]["rank"] == 1


async def test_vote_after_completion_returns_conflict(
    client: ApiTestClient,
) -> None:
    completed = await finish_session(client)

    response = await vote(client, completed, "better")

    assert response.status_code == 409
    assert response.json()["code"] == "ranking_complete"
    assert response.json()["current_version"] == completed["version"]


async def test_tie_rank_skips_following_position(
    client: ApiTestClient,
) -> None:
    current = await create_session(client)
    first_vote = await vote(client, current, "tie")
    current = await finish_session(client, first_vote.json())

    assert current["ranking"][0]["rank"] == 1
    assert len(current["ranking"][0]["players"]) == 2
    assert current["ranking"][1]["rank"] == 3


async def test_unknown_session_returns_structured_not_found(
    client: ApiTestClient,
) -> None:
    response = await client.get("/api/v1/sessions/not-a-session")

    assert response.status_code == 404
    assert response.json()["code"] == "session_not_found"
    assert response.json()["current_version"] is None


async def test_expired_session_returns_gone_and_cleanup_removes_it(
    client: ApiTestClient,
) -> None:
    initial_time = datetime(2026, 7, 23, 12, tzinfo=UTC)
    service = client.app.state.ranking_service
    service.clock = lambda: initial_time
    created = await create_session(client)
    service.clock = lambda: initial_time + timedelta(days=91)

    expired = await client.get(f"/api/v1/sessions/{created['id']}")

    assert expired.status_code == 410
    assert expired.json()["code"] == "session_expired"
    assert service.cleanup_expired() == 1
    missing = await client.get(f"/api/v1/sessions/{created['id']}")
    assert missing.status_code == 404


async def test_corrupt_session_is_not_silently_reset(
    client: ApiTestClient,
) -> None:
    created = await create_session(client)
    database = client.app.state.database
    with database.session_factory.begin() as session:
        session.execute(
            update(RankingSessionRecord)
            .where(RankingSessionRecord.id == created["id"])
            .values(state_json='{"schema_version":999}')
        )

    response = await client.get(f"/api/v1/sessions/{created['id']}")

    assert response.status_code == 500
    assert response.json()["code"] == "corrupt_session"


async def test_delete_session_is_idempotent_and_cascades(
    client: ApiTestClient,
) -> None:
    created = await create_session(client)
    voted = await vote(client, created, "better")
    assert voted.status_code == 200

    first = await client.delete(f"/api/v1/sessions/{created['id']}")
    second = await client.delete(f"/api/v1/sessions/{created['id']}")

    assert first.status_code == 204
    assert second.status_code == 204
    assert (await client.get(f"/api/v1/sessions/{created['id']}")).status_code == 404
    database = client.app.state.database
    with database.session_factory() as session:
        assert (
            session.scalar(
                select(func.count())
                .select_from(RankingVoteRecord)
                .where(RankingVoteRecord.session_id == created["id"])
            )
            == 0
        )
        assert (
            session.scalar(
                select(func.count())
                .select_from(RankingOperationRecord)
                .where(RankingOperationRecord.session_id == created["id"])
            )
            == 0
        )
