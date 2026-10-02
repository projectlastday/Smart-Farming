# ADR 0001: Server-side opaque sessions

## Status
Accepted

## Context
AgriFusionNet requires secure authentication for farmers, admins, and superadmins without exposing JWTs to JavaScript.

## Decision
Use cryptographically random opaque session tokens in HttpOnly cookies with SHA-256 hashes stored in MySQL, CSRF double-submit headers, and session rotation on privilege changes.

## Consequences
- Frontend must fetch CSRF token from `/auth/session` for mutations.
- Horizontal scaling requires shared session store (acceptable for school laptop deployment).
