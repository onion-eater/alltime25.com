"""Persist ranking preset and identity mode.

Revision ID: 20260724_0002
Revises: 20260723_0001
Create Date: 2026-07-24
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260724_0002"
down_revision: str | None = "20260723_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "ranking_sessions",
        sa.Column(
            "preset",
            sa.String(length=16),
            nullable=False,
            server_default="top_25",
        ),
    )
    op.add_column(
        "ranking_sessions",
        sa.Column(
            "identity_mode",
            sa.String(length=16),
            nullable=False,
            server_default="normal",
        ),
    )
    op.execute(sa.text("DELETE FROM ranking_sessions"))


def downgrade() -> None:
    with op.batch_alter_table("ranking_sessions") as batch:
        batch.drop_column("identity_mode")
        batch.drop_column("preset")
