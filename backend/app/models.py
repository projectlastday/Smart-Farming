import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class UserRole(str, enum.Enum):
    farmer = "farmer"
    admin = "admin"
    superadmin = "superadmin"


class UserStatus(str, enum.Enum):
    active = "active"
    disabled = "disabled"
    anonymized = "anonymized"


class CropType(str, enum.Enum):
    rice = "rice"
    guava = "guava"


class CycleStatus(str, enum.Enum):
    planned = "planned"
    planted = "planted"
    growing = "growing"
    harvest_ready = "harvest-ready"
    harvested = "harvested"
    archived = "archived"


class SyncState(str, enum.Enum):
    synced = "synced"
    local_queued = "local_queued"


def new_uuid() -> str:
    return str(uuid.uuid4())


class ReferenceEntry(Base):
    __tablename__ = "reference_entries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    reference_type: Mapped[str] = mapped_column(String(50), index=True)
    crop: Mapped[CropType] = mapped_column(Enum(CropType))
    key_code: Mapped[str] = mapped_column(String(50), unique=True)
    display_value: Mapped[str] = mapped_column(String(100))
    scientific_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (Index("ix_users_status_anonymized_at", "status", "anonymized_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole))
    status: Mapped[UserStatus] = mapped_column(Enum(UserStatus), default=UserStatus.active)
    session_version: Mapped[int] = mapped_column(default=1)
    must_change_password: Mapped[bool] = mapped_column(default=False)
    anonymized_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    farms: Mapped[list["Farm"]] = relationship(back_populates="farmer")
    sessions: Mapped[list["SessionToken"]] = relationship(back_populates="user")


class SessionToken(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    session_hash: Mapped[str] = mapped_column(String(64), index=True)
    csrf_token_hash: Mapped[str] = mapped_column(String(64))
    user_session_version: Mapped[int] = mapped_column(default=1)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped[User] = relationship(back_populates="sessions")


class Farm(Base):
    __tablename__ = "farms"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(255))
    location: Mapped[str] = mapped_column(String(255))
    farmer_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    farmer: Mapped[User] = relationship(back_populates="farms")
    crop_cycles: Mapped[list["CropCycle"]] = relationship(back_populates="farm")


class CropCycle(Base):
    __tablename__ = "crop_cycles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    farm_id: Mapped[str] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"))
    crop: Mapped[CropType] = mapped_column(Enum(CropType))
    variety: Mapped[str] = mapped_column(String(100))
    planting_date: Mapped[datetime] = mapped_column(Date)
    area: Mapped[float] = mapped_column(Numeric(10, 2))
    location: Mapped[str] = mapped_column(String(255))
    lifecycle_status: Mapped[CycleStatus] = mapped_column(
        Enum(CycleStatus), default=CycleStatus.planned
    )
    soil_inputs: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    actual_harvest_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    actual_yield: Mapped[float | None] = mapped_column(Numeric(12, 3), nullable=True)
    yield_unit: Mapped[str | None] = mapped_column(String(16), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    farm: Mapped[Farm] = relationship(back_populates="crop_cycles")
    predictions: Mapped[list["Prediction"]] = relationship(back_populates="crop_cycle")


class Prediction(Base):
    __tablename__ = "predictions"
    __table_args__ = (
        UniqueConstraint("user_id", "client_operation_id", name="uq_user_operation"),
        Index("ix_predictions_user_created", "user_id", "created_at"),
        Index("ix_predictions_cycle_feature_created", "crop_cycle_id", "feature_type", "created_at"),
        Index("ix_predictions_user_cycle", "user_id", "crop_cycle_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    farm_id: Mapped[str] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"))
    crop_cycle_id: Mapped[str] = mapped_column(
        ForeignKey("crop_cycles.id", ondelete="CASCADE")
    )
    feature_type: Mapped[str] = mapped_column(String(50))
    model_version: Mapped[str] = mapped_column(String(50))
    inputs_snapshot: Mapped[dict] = mapped_column(JSON)
    output: Mapped[dict] = mapped_column(JSON)
    confidence: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    assumptions: Mapped[str | None] = mapped_column(Text, nullable=True)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommendation: Mapped[str | None] = mapped_column(Text, nullable=True)
    provenance: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    sync_state: Mapped[SyncState] = mapped_column(
        Enum(SyncState), default=SyncState.synced
    )
    client_operation_id: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    crop_cycle: Mapped[CropCycle] = relationship(back_populates="predictions")
    saved_images: Mapped[list["SavedImage"]] = relationship(back_populates="prediction")


class SavedImage(Base):
    __tablename__ = "saved_images"
    __table_args__ = (Index("ix_saved_images_created_at", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    prediction_id: Mapped[str] = mapped_column(
        ForeignKey("predictions.id", ondelete="CASCADE")
    )
    path: Mapped[str] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    prediction: Mapped[Prediction] = relationship(back_populates="saved_images")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_logs_timestamp", "timestamp"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    actor_id: Mapped[str] = mapped_column(String(36), index=True)
    action: Mapped[str] = mapped_column(String(100))
    target_type: Mapped[str] = mapped_column(String(100))
    target_id: Mapped[str] = mapped_column(String(36))
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
