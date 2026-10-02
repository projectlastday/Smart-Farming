"""Alembic migration head matches live database."""

from sqlalchemy import create_engine, text

from app.config import settings


def test_alembic_head_matches_database():
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    cfg = Config("alembic.ini")
    script = ScriptDirectory.from_config(cfg)
    head = script.get_current_head()
    engine = create_engine(settings.database_url)
    with engine.connect() as conn:
        row = conn.execute(text("SELECT version_num FROM alembic_version")).fetchone()
    assert row is not None
    assert row[0] == head
