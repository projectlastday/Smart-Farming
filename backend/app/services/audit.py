from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models import AuditLog


def write_audit(
    db: Session,
    *,
    actor_id: str,
    action: str,
    target_type: str,
    target_id: str,
    metadata: dict | None = None,
) -> None:
    db.add(
        AuditLog(
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            metadata_json=metadata,
            timestamp=datetime.now(UTC).replace(tzinfo=None),
        )
    )
