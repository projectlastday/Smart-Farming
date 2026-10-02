import time
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_recycle=3600,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def wait_for_database(max_seconds: int = 60) -> None:
    deadline = time.time() + max_seconds
    delay = 1.0
    last_error: Exception | None = None
    while time.time() < deadline:
        try:
            with engine.connect() as conn:
                conn.exec_driver_sql("SELECT 1")
            return
        except Exception as exc:  # noqa: BLE001 - startup retry loop
            last_error = exc
            time.sleep(delay)
            delay = min(delay * 2, 8.0)
    raise RuntimeError("Database not ready") from last_error


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
