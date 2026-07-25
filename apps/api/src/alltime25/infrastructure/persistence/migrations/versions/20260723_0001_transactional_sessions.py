"""Create transactional ranking session tables.

Revision ID: 20260723_0001
Revises:
Create Date: 2026-07-23
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260723_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ranking_sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("catalog_id", sa.String(length=128), nullable=False),
        sa.Column("player_order_json", sa.Text(), nullable=False),
        sa.Column("state_json", sa.Text(), nullable=False),
        sa.Column("state_schema_version", sa.Integer(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ranking_sessions_expires_at",
        "ranking_sessions",
        ["expires_at"],
    )
    op.create_table(
        "ranking_operations",
        sa.Column("operation_id", sa.String(length=36), nullable=False),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("operation_type", sa.String(length=16), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("expected_version", sa.Integer(), nullable=True),
        sa.Column("resulting_version", sa.Integer(), nullable=False),
        sa.Column("result_state_json", sa.Text(), nullable=False),
        sa.Column("result_can_undo", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["ranking_sessions.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("operation_id"),
    )
    op.create_index(
        "ix_ranking_operations_session_id",
        "ranking_operations",
        ["session_id"],
    )
    op.create_table(
        "ranking_votes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("operation_id", sa.String(length=36), nullable=False),
        sa.Column("outcome", sa.String(length=16), nullable=False),
        sa.Column("state_before_json", sa.Text(), nullable=False),
        sa.Column("state_after_json", sa.Text(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("undone_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["ranking_sessions.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "session_id",
            "sequence",
            name="uq_ranking_votes_session_sequence",
        ),
    )
    op.create_index(
        "ix_ranking_votes_session_id",
        "ranking_votes",
        ["session_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_ranking_votes_session_id",
        table_name="ranking_votes",
    )
    op.drop_table("ranking_votes")
    op.drop_index(
        "ix_ranking_operations_session_id",
        table_name="ranking_operations",
    )
    op.drop_table("ranking_operations")
    op.drop_index(
        "ix_ranking_sessions_expires_at",
        table_name="ranking_sessions",
    )
    op.drop_table("ranking_sessions")
