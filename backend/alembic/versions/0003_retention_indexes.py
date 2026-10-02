"""Phase 6 retention indexes

Revision ID: 0003_retention_indexes
Revises: 0002_harvest_indexes
Create Date: 2026-09-01
"""

from alembic import op

revision = "0003_retention_indexes"
down_revision = "0002_harvest_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_audit_logs_timestamp", "audit_logs", ["timestamp"])
    op.create_index("ix_saved_images_created_at", "saved_images", ["created_at"])
    op.create_index("ix_users_status_anonymized_at", "users", ["status", "anonymized_at"])


def downgrade() -> None:
    op.drop_index("ix_users_status_anonymized_at", table_name="users")
    op.drop_index("ix_saved_images_created_at", table_name="saved_images")
    op.drop_index("ix_audit_logs_timestamp", table_name="audit_logs")
