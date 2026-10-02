"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-08-28
"""

from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "reference_entries",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("reference_type", sa.String(length=50), nullable=False),
        sa.Column("crop", sa.Enum("rice", "guava", name="crop_type"), nullable=False),
        sa.Column("key_code", sa.String(length=50), nullable=False),
        sa.Column("display_value", sa.String(length=100), nullable=False),
        sa.Column("scientific_metadata", sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key_code"),
    )
    op.create_index("ix_reference_entries_reference_type", "reference_entries", ["reference_type"])

    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("role", sa.Enum("farmer", "admin", "superadmin", name="user_role_type"), nullable=False),
        sa.Column("status", sa.Enum("active", "disabled", "anonymized", name="user_status_type"), nullable=False),
        sa.Column("session_version", sa.Integer(), nullable=False),
        sa.Column("must_change_password", sa.Boolean(), nullable=False),
        sa.Column("anonymized_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("session_hash", sa.String(length=64), nullable=False),
        sa.Column("csrf_token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sessions_session_hash", "sessions", ["session_hash"])

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

    op.create_table(
        "farms",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=False),
        sa.Column("farmer_id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["farmer_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "crop_cycles",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("farm_id", sa.String(length=36), nullable=False),
        sa.Column("crop", sa.Enum("rice", "guava", name="cycle_crop_type"), nullable=False),
        sa.Column("variety", sa.String(length=100), nullable=False),
        sa.Column("planting_date", sa.Date(), nullable=False),
        sa.Column("area", sa.Numeric(10, 2), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=False),
        sa.Column(
            "lifecycle_status",
            sa.Enum(
                "planned",
                "planted",
                "growing",
                "harvest-ready",
                "harvested",
                "archived",
                name="cycle_status_type",
            ),
            nullable=False,
        ),
        sa.Column("soil_inputs", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["farm_id"], ["farms.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "predictions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("farm_id", sa.String(length=36), nullable=False),
        sa.Column("crop_cycle_id", sa.String(length=36), nullable=False),
        sa.Column("feature_type", sa.String(length=50), nullable=False),
        sa.Column("model_version", sa.String(length=50), nullable=False),
        sa.Column("inputs_snapshot", sa.JSON(), nullable=False),
        sa.Column("output", sa.JSON(), nullable=False),
        sa.Column("confidence", sa.Numeric(5, 2), nullable=True),
        sa.Column("assumptions", sa.Text(), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("recommendation", sa.Text(), nullable=True),
        sa.Column("provenance", sa.JSON(), nullable=True),
        sa.Column("sync_state", sa.Enum("synced", "local_queued", name="sync_state_type"), nullable=False),
        sa.Column("client_operation_id", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["crop_cycle_id"], ["crop_cycles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["farm_id"], ["farms.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "client_operation_id", name="uq_user_operation"),
    )

    op.create_table(
        "saved_images",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("prediction_id", sa.String(length=36), nullable=False),
        sa.Column("path", sa.String(length=512), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["prediction_id"], ["predictions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("actor_id", sa.String(length=36), nullable=False),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("target_type", sa.String(length=100), nullable=False),
        sa.Column("target_id", sa.String(length=36), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("timestamp", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"])


def downgrade() -> None:
    op.drop_index("ix_audit_logs_actor_id", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_table("saved_images")
    op.drop_table("predictions")
    op.drop_table("crop_cycles")
    op.drop_table("farms")
    op.drop_table("admin_setup_tokens")
    op.drop_index("ix_sessions_session_hash", table_name="sessions")
    op.drop_table("sessions")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
    op.drop_index("ix_reference_entries_reference_type", table_name="reference_entries")
    op.drop_table("reference_entries")
