from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUserContext, require_csrf, require_roles
from app.auth.security import hash_password, revoke_all_sessions
from app.db import get_db
from app.models import AuditLog, ReferenceEntry, User, UserRole, UserStatus
from app.schemas import (
    AdminCreateFarmerRequest,
    MessageResponse,
    ReferenceEntryOut,
    UserOut,
)
from app.services.audit import write_audit
from app.services.features import anonymize_user

router = APIRouter(prefix="/admin", tags=["admin"])


def user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        name=user.email if user.status == UserStatus.anonymized else user.name,
        email=user.email,
        phone=user.phone,
        role=user.role.value,
        status=user.status.value,
        must_change_password=user.must_change_password,
    )


@router.get("/farmers", response_model=list[UserOut])
def list_farmers(
    ctx: CurrentUserContext = Depends(require_roles(UserRole.admin, UserRole.superadmin)),
    db: Session = Depends(get_db),
):
    farmers = db.query(User).filter(User.role == UserRole.farmer).all()
    return [user_out(u) for u in farmers]


@router.post("/farmers", response_model=UserOut)
def create_farmer(
    payload: AdminCreateFarmerRequest,
    ctx: CurrentUserContext = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    if ctx.user.role not in {UserRole.admin, UserRole.superadmin}:
        raise HTTPException(status_code=403, detail="Akses ditolak")
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    user = User(
        name=payload.name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        phone=payload.phone,
        role=UserRole.farmer,
        status=UserStatus.active,
        must_change_password=False,
    )
    db.add(user)
    db.flush()
    write_audit(
        db,
        actor_id=ctx.user.id,
        action="farmer.created",
        target_type="users",
        target_id=user.id,
        metadata={"email": user.email, "role": "farmer"},
    )
    db.commit()
    return user_out(user)


@router.post("/farmers/{user_id}/disable", response_model=MessageResponse)
def disable_farmer(
    user_id: str,
    ctx: CurrentUserContext = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    if ctx.user.role not in {UserRole.admin, UserRole.superadmin}:
        raise HTTPException(status_code=403, detail="Akses ditolak")
    user = db.query(User).filter(User.id == user_id, User.role == UserRole.farmer).first()
    if not user:
        raise HTTPException(status_code=404, detail="Petani tidak ditemukan")
    user.status = UserStatus.disabled
    revoke_all_sessions(db, user)
    write_audit(
        db,
        actor_id=ctx.user.id,
        action="user.disable",
        target_type="users",
        target_id=user.id,
    )
    db.commit()
    return MessageResponse(message="Akun petani dinonaktifkan")


@router.post("/farmers/{user_id}/enable", response_model=MessageResponse)
def enable_farmer(
    user_id: str,
    ctx: CurrentUserContext = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    if ctx.user.role not in {UserRole.admin, UserRole.superadmin}:
        raise HTTPException(status_code=403, detail="Akses ditolak")
    user = db.query(User).filter(User.id == user_id, User.role == UserRole.farmer).first()
    if not user:
        raise HTTPException(status_code=404, detail="Petani tidak ditemukan")
    if user.status == UserStatus.anonymized:
        raise HTTPException(status_code=400, detail="Akun yang dianonimkan tidak dapat diaktifkan")
    user.status = UserStatus.active
    write_audit(
        db,
        actor_id=ctx.user.id,
        action="user.enable",
        target_type="users",
        target_id=user.id,
    )
    db.commit()
    return MessageResponse(message="Akun petani diaktifkan")


@router.get("/reference", response_model=list[ReferenceEntryOut])
def list_reference(
    ctx: CurrentUserContext = Depends(require_roles(UserRole.admin, UserRole.superadmin)),
    db: Session = Depends(get_db),
):
    rows = db.query(ReferenceEntry).order_by(ReferenceEntry.reference_type, ReferenceEntry.key_code).all()
    return [
        ReferenceEntryOut(
            id=row.id,
            reference_type=row.reference_type,
            crop=row.crop.value,
            key_code=row.key_code,
            display_value=row.display_value,
            scientific_metadata=row.scientific_metadata,
        )
        for row in rows
    ]


@router.get("/audit", response_model=list[dict])
def list_audit(
    ctx: CurrentUserContext = Depends(require_roles(UserRole.superadmin)),
    db: Session = Depends(get_db),
):
    rows = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(100).all()
    return [
        {
            "id": row.id,
            "actor_id": row.actor_id,
            "action": row.action,
            "target_type": row.target_type,
            "target_id": row.target_id,
            "metadata": row.metadata_json,
            "timestamp": row.timestamp.isoformat(),
        }
        for row in rows
    ]


@router.post("/users/{user_id}/anonymize", response_model=MessageResponse)
def anonymize_account(
    user_id: str,
    ctx: CurrentUserContext = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    if ctx.user.role != UserRole.superadmin:
        raise HTTPException(status_code=403, detail="Hanya superadmin")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    anonymize_user(db, ctx.user.id, user)
    db.commit()
    return MessageResponse(message="Akun dianonimkan")
