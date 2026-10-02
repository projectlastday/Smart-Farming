"""Isolated MySQL backup/restore drill. Never writes into the demo database."""

from __future__ import annotations

import uuid
from urllib.parse import unquote, urlparse

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError, ProgrammingError

from app.config import settings

DEMO_DB_NAMES = {"agrifusionnet"}
DRILL_PREFIX = "agrifusionnet_drill_"


def _server_url(database_url: str) -> tuple[str, str]:
    parsed = urlparse(database_url)
    dbname = (parsed.path or "/").lstrip("/").split("?")[0]
    user = unquote(parsed.username or "")
    password = unquote(parsed.password or "")
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or 3306
    auth = f"{user}:{password}@" if user else ""
    server = f"mysql+pymysql://{auth}{host}:{port}/?charset=utf8mb4"
    return server, dbname


def run_backup_restore_drill(database_url: str | None = None) -> dict[str, str | int | bool]:
    url = database_url or settings.database_url
    server_url, current_db = _server_url(url)
    server_engine = create_engine(server_url, isolation_level="AUTOCOMMIT")
    try:
        return _schema_drill(server_engine, current_db)
    except (OperationalError, ProgrammingError):
        db_engine = create_engine(url, isolation_level="AUTOCOMMIT")
        try:
            return _table_drill(db_engine, current_db)
        finally:
            db_engine.dispose()
    finally:
        server_engine.dispose()


def _schema_drill(engine, current_db: str) -> dict[str, str | int | bool]:
    schema = f"{DRILL_PREFIX}{uuid.uuid4().hex[:10]}"
    marker = f"drill-{uuid.uuid4().hex}"
    with engine.connect() as conn:
        conn.execute(
            text(f"CREATE DATABASE `{schema}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        )
        try:
            conn.execute(text(f"USE `{schema}`"))
            conn.execute(
                text(
                    "CREATE TABLE restore_marker ("
                    "id INT PRIMARY KEY, "
                    "token VARCHAR(64) NOT NULL, "
                    "note VARCHAR(128) NULL"
                    ") ENGINE=InnoDB"
                )
            )
            conn.execute(
                text(
                    "INSERT INTO restore_marker (id, token, note) VALUES (1, :token, 'isolated-drill')"
                ),
                {"token": marker},
            )
            create_sql = conn.execute(text("SHOW CREATE TABLE restore_marker")).one()[1]
            conn.execute(text(f"DROP DATABASE `{schema}`"))
            conn.execute(
                text(f"CREATE DATABASE `{schema}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            )
            conn.execute(text(f"USE `{schema}`"))
            conn.execute(text(create_sql))
            conn.execute(
                text(
                    "INSERT INTO restore_marker (id, token, note) VALUES (1, :token, 'isolated-drill')"
                ),
                {"token": marker},
            )
            restored = conn.execute(text("SELECT token, note FROM restore_marker WHERE id = 1")).one()
            if restored[0] != marker or restored[1] != "isolated-drill":
                raise RuntimeError("restore marker mismatch")
        finally:
            conn.execute(text(f"DROP DATABASE IF EXISTS `{schema}`"))
    return {
        "ok": True,
        "mode": "temporary_schema",
        "schema": schema,
        "source_database": current_db,
        "demo_database_modified": False,
        "marker_verified": True,
    }


def _table_drill(engine, current_db: str) -> dict[str, str | int | bool]:
    if current_db in DEMO_DB_NAMES:
        raise RuntimeError("refusing table-level drill on the demo database")
    table = f"drill_restore_{uuid.uuid4().hex[:10]}"
    marker = f"drill-{uuid.uuid4().hex}"
    with engine.connect() as conn:
        conn.execute(
            text(
                f"CREATE TABLE `{table}` ("
                "id INT PRIMARY KEY, "
                "token VARCHAR(64) NOT NULL, "
                "note VARCHAR(128) NULL"
                ") ENGINE=InnoDB"
            )
        )
        try:
            conn.execute(
                text(f"INSERT INTO `{table}` (id, token, note) VALUES (1, :token, 'isolated-drill')"),
                {"token": marker},
            )
            create_sql = conn.execute(text(f"SHOW CREATE TABLE `{table}`")).one()[1]
            conn.execute(text(f"DROP TABLE `{table}`"))
            conn.execute(text(create_sql))
            conn.execute(
                text(f"INSERT INTO `{table}` (id, token, note) VALUES (1, :token, 'isolated-drill')"),
                {"token": marker},
            )
            restored = conn.execute(text(f"SELECT token, note FROM `{table}` WHERE id = 1")).one()
            if restored[0] != marker or restored[1] != "isolated-drill":
                raise RuntimeError("restore marker mismatch")
        finally:
            conn.execute(text(f"DROP TABLE IF EXISTS `{table}`"))
    return {
        "ok": True,
        "mode": "temporary_table",
        "schema": current_db,
        "table": table,
        "source_database": current_db,
        "demo_database_modified": False,
        "marker_verified": True,
    }
