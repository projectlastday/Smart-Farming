"""harvest lifecycle, indexes, and session version

Revision ID: 0002_harvest_indexes
Revises: 0001_initial
Create Date: 2026-08-31
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_harvest_indexes"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("crop_cycles", sa.Column("actual_harvest_date", sa.Date(), nullable=True))
    op.add_column("crop_cycles", sa.Column("actual_yield", sa.Numeric(12, 3), nullable=True))
    op.add_column("crop_cycles", sa.Column("yield_unit", sa.String(length=16), nullable=True))
    op.add_column(
        "sessions",
        sa.Column("user_session_version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_index("ix_farms_farmer_id", "farms", ["farmer_id"])
    op.create_index("ix_crop_cycles_farm_id", "crop_cycles", ["farm_id"])
    op.create_index("ix_predictions_user_created", "predictions", ["user_id", "created_at"])
    op.create_index(
        "ix_predictions_cycle_feature_created",
        "predictions",
        ["crop_cycle_id", "feature_type", "created_at"],
    )
    op.create_index("ix_predictions_user_cycle", "predictions", ["user_id", "crop_cycle_id"])
    op.create_index("ix_saved_images_prediction_id", "saved_images", ["prediction_id"])
    op.execute(
        """
        UPDATE crop_cycles
        SET variety = 'Jambu Standar'
        WHERE variety IN ('jambu_standart', 'jambu_standard')
        """
    )


def downgrade() -> None:
    op.drop_index("ix_saved_images_prediction_id", table_name="saved_images")
    op.drop_index("ix_predictions_user_cycle", table_name="predictions")
    op.drop_index("ix_predictions_cycle_feature_created", table_name="predictions")
    op.drop_index("ix_predictions_user_created", table_name="predictions")
    op.drop_index("ix_crop_cycles_farm_id", table_name="crop_cycles")
    op.drop_index("ix_farms_farmer_id", table_name="farms")
    op.drop_column("sessions", "user_session_version")
    op.drop_column("crop_cycles", "yield_unit")
    op.drop_column("crop_cycles", "actual_yield")
    op.drop_column("crop_cycles", "actual_harvest_date")
