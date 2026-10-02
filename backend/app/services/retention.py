"""Retention/privacy lifecycle for images, predictions, audit logs, and anonymized accounts."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy.orm import Session

from app.config import settings
from app.models import AuditLog, Prediction, SavedImage, User, UserStatus
from app.services.audit import write_audit
from app.services.uploads import cleanup_path


def run_retention(db: Session, *, now: datetime | None = None, actor_id: str = "system") -> dict[str, int]:
    now = now or datetime.now(UTC).replace(tzinfo=None)
    images_deleted = 0
    predictions_deleted = 0
    audit_deleted = 0
    users_deleted = 0

    image_cutoff = now - timedelta(days=settings.saved_image_retention_days)
    old_images = db.query(SavedImage).filter(SavedImage.created_at < image_cutoff).all()
    for image in old_images:
        cleanup_path(Path(image.path))
        db.delete(image)
        images_deleted += 1

    prediction_cutoff = now - timedelta(days=settings.prediction_retention_days)
    old_predictions = db.query(Prediction).filter(Prediction.created_at < prediction_cutoff).all()
    for prediction in old_predictions:
        for image in list(prediction.saved_images):
            cleanup_path(Path(image.path))
            db.delete(image)
            images_deleted += 1
        db.delete(prediction)
        predictions_deleted += 1

    audit_cutoff = now - timedelta(days=settings.audit_log_retention_days)
    audit_deleted = (
        db.query(AuditLog)
        .filter(AuditLog.timestamp < audit_cutoff)
        .delete(synchronize_session=False)
    )

    user_cutoff = now - timedelta(days=settings.anonymized_hard_delete_days)
    old_users = (
        db.query(User)
        .filter(
            User.status == UserStatus.anonymized,
            User.anonymized_at.is_not(None),
            User.anonymized_at < user_cutoff,
        )
        .all()
    )
    for user in old_users:
        db.delete(user)
        users_deleted += 1

    write_audit(
        db,
        actor_id=actor_id,
        action="retention.cleanup",
        target_type="system",
        target_id="retention",
        metadata={
            "saved_images_deleted": images_deleted,
            "predictions_deleted": predictions_deleted,
            "audit_logs_deleted": int(audit_deleted or 0),
            "anonymized_users_deleted": users_deleted,
        },
    )
    db.flush()
    return {
        "saved_images_deleted": images_deleted,
        "predictions_deleted": predictions_deleted,
        "audit_logs_deleted": int(audit_deleted or 0),
        "anonymized_users_deleted": users_deleted,
    }
