# ADR 0002: MySQL-only persistence

## Status
Accepted

## Decision
Use MySQL 8.4 with utf8mb4 for application and integration tests. SQLite is not used.

## Consequences
- Tests run against Dockerized MySQL with Alembic migrations from empty schema.
