# ADR 0003: Offline prediction queue

## Status
Accepted

## Decision
Store offline-created predictions in IndexedDB with `client_operation_id`; backend enforces `(user_id, client_operation_id)` uniqueness for exactly-once sync.

## Consequences
- TanStack Query cache is not the authoritative offline mutation queue.
- Credentials and session tokens are never stored in IndexedDB.
