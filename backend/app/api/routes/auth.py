from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.auth.dependencies import (
    clear_session_cookie,
    get_current_user,
    require_csrf,
    set_session_cookie,
    CurrentUserContext,
)
from app.auth.security import bootstrap_superadmin, create_session, hash_password, hash_token, revoke_all_sessions, verify_password
from app.config import settings
from app.db import get_db
from app.models import User, UserRole, UserStatus
from app.schemas import (
    AdminCreateUserRequest,
    LoginRequest,
    MessageResponse,
    PasswordChangeRequest,
    RegisterRequest,
    SessionOut,
    UserOut,
)
from app.services.audit import write_audit

router = APIRouter(prefix="/auth", tags=["auth"])


def user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        name=user.name,
        email=user.email,
        phone=user.phone,
        role=user.role.value,
        status=user.status.value,
        must_change_password=user.must_change_password,
    )


@router.get("/session", response_model=SessionOut)
def get_session(ctx: CurrentUserContext = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.auth.security import generate_token

    csrf = generate_token()
    ctx.session.csrf_token_hash = hash_token(csrf)
    db.commit()
    return SessionOut(user=user_out(ctx.user), csrf_token=csrf)


@router.post("/register", response_model=SessionOut)
def register(
    payload: RegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    if not settings.allow_farmer_self_registration:
        raise HTTPException(status_code=403, detail="Registrasi mandiri dinonaktifkan")
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    user = User(
        name=payload.name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        phone=payload.phone,
        role=UserRole.farmer,
        status=UserStatus.active,
    )
    db.add(user)
    db.flush()
    token, csrf, _ = create_session(db, user)
    db.commit()
    set_session_cookie(response, token)
    return SessionOut(user=user_out(user), csrf_token=csrf)


@router.post("/login", response_model=SessionOut)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(user.password_hash, payload.password):
        raise HTTPException(status_code=401, detail="Email atau kata sandi salah")
    if user.status == UserStatus.anonymized:
        raise HTTPException(status_code=401, detail="Email atau kata sandi salah")
    if user.status == UserStatus.disabled:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "ACCOUNT_DISABLED",
                "message": "Akun dinonaktifkan. Hubungi administrator.",
            },
        )
    if user.must_change_password:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "PASSWORD_SETUP_REQUIRED",
                "message": "Akun belum memiliki kata sandi. Hubungi administrator.",
            },
        )
    revoke_all_sessions(db, user)
    token, csrf, _ = create_session(db, user)
    db.commit()
    set_session_cookie(response, token)
    return SessionOut(user=user_out(user), csrf_token=csrf)


@router.post("/logout", response_model=MessageResponse)
def logout(
    response: Response,
    ctx: CurrentUserContext = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    from app.models import SessionToken

    db.query(SessionToken).filter(SessionToken.id == ctx.session.id).delete()
    db.commit()
    clear_session_cookie(response)
    return MessageResponse(message="Logout berhasil")


@router.post("/password/change", response_model=SessionOut)
def password_change(
    payload: PasswordChangeRequest,
    response: Response,
    ctx: CurrentUserContext = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    if not verify_password(ctx.user.password_hash, payload.current_password):
        raise HTTPException(status_code=400, detail="Kata sandi saat ini salah")
    ctx.user.password_hash = hash_password(payload.new_password)
    revoke_all_sessions(db, ctx.user)
    token, csrf, _session = create_session(db, ctx.user)
    db.commit()
    set_session_cookie(response, token)
    return SessionOut(user=user_out(ctx.user), csrf_token=csrf)


@router.post("/admin/create", response_model=UserOut)
def create_admin(
    payload: AdminCreateUserRequest,
    ctx: CurrentUserContext = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    if ctx.user.role == UserRole.admin and payload.role != "farmer":
        raise HTTPException(status_code=403, detail="Admin hanya dapat membuat akun petani")
    if ctx.user.role == UserRole.superadmin and payload.role not in {"admin", "farmer"}:
        raise HTTPException(status_code=400, detail="Peran tidak valid")
    if ctx.user.role not in {UserRole.admin, UserRole.superadmin}:
        raise HTTPException(status_code=403, detail="Akses ditolak")
    if payload.role not in {"admin", "farmer"}:
        raise HTTPException(status_code=400, detail="Peran tidak valid")
    if payload.role == "admin" and ctx.user.role != UserRole.superadmin:
        raise HTTPException(status_code=403, detail="Hanya superadmin dapat membuat admin")
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    user = User(
        name=payload.name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        phone=payload.phone,
        role=UserRole(payload.role),
        status=UserStatus.active,
        must_change_password=False,
    )
    db.add(user)
    db.flush()
    write_audit(
        db,
        actor_id=ctx.user.id,
        action="admin.created",
        target_type="users",
        target_id=user.id,
        metadata={"role": payload.role, "email": user.email},
    )
    db.commit()
    return user_out(user)
