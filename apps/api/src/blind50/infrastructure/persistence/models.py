from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class RankingSessionRecord(Base):
    __tablename__ = "ranking_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    catalog_id: Mapped[str] = mapped_column(String(128), nullable=False)
    preset: Mapped[str] = mapped_column(String(16), nullable=False)
    identity_mode: Mapped[str] = mapped_column(String(16), nullable=False)
    player_order_json: Mapped[str] = mapped_column(Text, nullable=False)
    state_json: Mapped[str] = mapped_column(Text, nullable=False)
    state_schema_version: Mapped[int] = mapped_column(Integer, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )


class RankingVoteRecord(Base):
    __tablename__ = "ranking_votes"
    __table_args__ = (
        UniqueConstraint(
            "session_id",
            "sequence",
            name="uq_ranking_votes_session_sequence",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("ranking_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    operation_id: Mapped[str] = mapped_column(String(36), nullable=False)
    outcome: Mapped[str] = mapped_column(String(16), nullable=False)
    state_before_json: Mapped[str] = mapped_column(Text, nullable=False)
    state_after_json: Mapped[str] = mapped_column(Text, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    undone_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )


class RankingOperationRecord(Base):
    __tablename__ = "ranking_operations"

    operation_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("ranking_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    operation_type: Mapped[str] = mapped_column(String(16), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    expected_version: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    resulting_version: Mapped[int] = mapped_column(Integer, nullable=False)
    result_state_json: Mapped[str] = mapped_column(Text, nullable=False)
    result_can_undo: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
