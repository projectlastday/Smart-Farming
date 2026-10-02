from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import Depends, Header, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.auth.security import hash_token
from app.config import settings
from app.db import get_db
from app.models import SessionToken, User, UserRole, UserStatus


@dataclass
class CurrentUserContext:
    user: User
    session: SessionToken
    csrf_token: str


def _validate_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if not settings.origin_allowed(origin):
        raise HTTPException(status_code=403, detail="Origin tidak valid")


def get_optional_user(
    request: Request,
    db: Session = Depends(get_db),
) -> CurrentUserContext | None:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        return None
    session = (
        db.query(SessionToken)
        .filter(SessionToken.session_hash == hash_token(token))
        .first()
    )
    if not session or session.expires_at < datetime.now(UTC).replace(tzinfo=None):
        return None
    user = db.query(User).filter(User.id == session.user_id).first()
    if not user or user.status == UserStatus.disabled:
        return None
    if getattr(session, "user_session_version", 1) != user.session_version:
        return None
    csrf = request.headers.get(settings.csrf_header_name, "")
    return CurrentUserContext(user=user, session=session, csrf_token=csrf)


def get_current_user(
    ctx: CurrentUserContext | None = Depends(get_optional_user),
) -> CurrentUserContext:
    if not ctx:
        raise HTTPException(status_code=401, detail="Sesi tidak valid")
    if ctx.user.status == UserStatus.disabled:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "ACCOUNT_DISABLED",
                "message": "Akun dinonaktifkan. Hubungi administrator.",
            },
        )
    return ctx


def require_csrf(
    request: Request,
    ctx: CurrentUserContext = Depends(get_current_user),
) -> CurrentUserContext:
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        _validate_origin(request)
        header = request.headers.get(settings.csrf_header_name)
        if not header or hash_token(header) != ctx.session.csrf_token_hash:
            raise HTTPException(status_code=403, detail="CSRF token tidak valid")
    return ctx


def require_roles(*roles: UserRole):
    def dependency(ctx: CurrentUserContext = Depends(get_current_user)) -> CurrentUserContext:
        if ctx.user.role not in roles:
            raise HTTPException(status_code=403, detail="Akses ditolak")
        return ctx

    return dependency


def set_session_cookie(response: Response, session_token: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=session_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
        max_age=settings.session_ttl_hours * 3600,
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(settings.session_cookie_name, path="/")
