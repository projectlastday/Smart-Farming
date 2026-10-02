import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from sqlalchemy.orm import Session

from app.config import settings
from app.models import SessionToken, User, UserRole, UserStatus

password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        password_hasher.verify(password_hash, password)
        return True
    except VerifyMismatchError:
        return False


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def create_session(db: Session, user: User) -> tuple[str, str, SessionToken]:
    raw_token = generate_token()
    csrf_token = generate_token()
    session = SessionToken(
        user_id=user.id,
        session_hash=hash_token(raw_token),
        csrf_token_hash=hash_token(csrf_token),
        user_session_version=user.session_version,
        expires_at=datetime.now(UTC).replace(tzinfo=None)
        + timedelta(hours=settings.session_ttl_hours),
    )
    db.add(session)
    db.flush()
    return raw_token, csrf_token, session


def revoke_all_sessions(db: Session, user: User) -> None:
    user.session_version += 1
    db.query(SessionToken).filter(SessionToken.user_id == user.id).delete()


def bootstrap_superadmin(db: Session) -> User | None:
    existing = (
        db.query(User)
        .filter(User.role == UserRole.superadmin, User.status != UserStatus.anonymized)
        .first()
    )
    if existing:
        return None
    user = User(
        name=settings.superadmin_name,
        email=settings.superadmin_email.lower(),
        password_hash=hash_password(settings.superadmin_password),
        role=UserRole.superadmin,
        status=UserStatus.active,
    )
    db.add(user)
    db.flush()
    return user
