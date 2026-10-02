"""Remove the deprecated admin setup-token flow.

Revision ID: 0004_remove_setup_tokens
Revises: 0003_retention_indexes
Create Date: 2026-09-02
"""

from alembic import op
import sqlalchemy as sa


revision = "0004_remove_setup_tokens"
down_revision = "0003_retention_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("admin_setup_tokens")


def downgrade() -> None:
    op.create_table(
        "admin_setup_tokens",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("created_by_id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_admin_setup_tokens_token_hash", "admin_setup_tokens", ["token_hash"])
