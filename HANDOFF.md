# AgriFusionNet Implementation Handoff

Last updated: 2026-09-02
Current scope update (2026-10-13): farmland mapping has been removed from the application. The original planning/history below may still mention it; those sections are historical, not active implementation requirements. Existing mapping predictions are retained as legacy history and are not generated again.
Project directory: `/home/brian/projects/subdomains/domain brian/Smart Farming`  
Status: implemented on branch `audit-remediation`; demo stack at http://127.0.0.1:8005. Backend pytest 114 passed, frontend vitest 111 passed + tsc, Playwright desktop 80 + mobile 80 (160) including goal-acceptance, true-offline disease sync, accessibility, and PWA manifest/SW. `scripts/verify_compose_persistence.sh` passed. Public incognito walkthrough, physical Add-to-Home-Screen, and NVDA/VoiceOver remain owner-manual.

## Current architecture (as built)

- **Crops:** rice + guava only. Five features: harvest, soil, disease, rejuvenation, and offline sync.
- **Roles:** farmer (own farms/cycles/predictions), admin (farmer accounts only), superadmin (account management + audit + reference).
- **Data:** MySQL 8.4, Alembic (`0004_remove_setup_tokens` head), opaque `agrifusion_session` cookies, CSRF `X-CSRF-Token`. Tests use `agrifusionnet_test`.
- **Disease v1:** MobileNetV3-Small ONNX trained on a real Paddy Doctor subset (Hugging Face `Project-AgML/paddy_disease_classification`). Version `disease-mobilenet-v1-paddy-doctor`. Test accuracy 0.8800, macro F1 0.8805, unknown threshold 0.52. Synthetic leaf drawings are **not** used and must not be described as classification. Details: `docs/model-disease.md`.
- **Offline:** ONNX Runtime WASM from `/ort/` (precache), IndexedDB queue, `client_operation_id` exactly-once sync. CSRF is kept in `sessionStorage` so an offline reload can still sync after reconnect.
- **Rules:** harvest variety durations, soil advisory, and guava rejuvenation score. Reliability kind `rule_completeness` for rules; `model_probability` only for classified disease.
- **Local HTTP:** `COOKIE_SECURE_ENABLED=false`. Do not enable Secure cookies while serving `http://127.0.0.1:8005`. HSTS is omitted on localhost/HTTP :8005 and sent for `sf.projectdunia.my.id` over HTTPS (nginx public server + backend when `Host` matches `PUBLIC_ORIGIN` and the request is HTTPS).
- **External context:** NASA POWER and SoilGrids adapters use timeout, retry, disk cache, provenance, and explicit fallback (`demo_fallback` / `local_cache`). Harvest and soil remain rules. See `docs/external-adapters.md`.
- **Ops:** isolated backup/restore drill (`scripts/backup_restore_drill.sh`), retention CLI (`python -m app.cli retention-cleanup`), health `/api/v1/health/live|ready` and `/api/v1/metrics`. Runbook: `docs/ops-runbook.md`.
- **Out of v1:** native Android, extra crops, Copernicus live scene pipeline, six separate ML models. Physical phone PWA install and public-domain incognito rehearsal are owner steps (`IMPLEMENTATION-GOAL.md` §8).

## 1. Read This First

This file is the primary handoff for an engineering agent starting AgriFusionNet. It records the user's requirements, decisions made during planning, the role of each NotebookLM knowledge base, scientific guardrails, and an implementation sequence.

The repository is no longer empty. Read this file, then `IMPLEMENTATION-GOAL.md`, `docs/model-disease.md`, and `docs/rules.md` before changing disease training, roles, or persistence.

When making further changes:

1. Read this entire file and inspect the repository.
2. Query the appropriate NotebookLM notebook for details before making a material scientific, architectural, security, or operational decision.
3. Treat the two custom planning documents in each notebook as the authority when a general article or framework guide conflicts with a settled project decision.
4. Mark assumptions in code or ADRs. Ask the user when an unresolved choice would materially alter the product.
5. Keep all active features honest: do not substitute synthetic drawings for a real rice-leaf dataset, and do not present rules as calibrated model probabilities.

## 2. Original Assignment and Product Intent

Original assignment, translated from Indonesian:

> Create AI for agriculture with complete data from planting through harvest. The AI can predict harvest time, assess soil condition, identify plant disease, advise rejuvenation age, and include two additional features of your own.

The agreed interpretation is a responsive agricultural decision-support website named **AgriFusionNet**. It is a school prototype, not a production agronomy service. It must still demonstrate real end-to-end behavior, meaningful AI where appropriate, transparent rules where AI would be dishonest, persistence, authentication, and offline capability.

The website will run online on the user's old self-hosted laptop and be published through the user's existing Cloudflare Tunnel. It must also be an installable Progressive Web App (PWA). A native Android application is not required.

User-facing language is **Indonesian**. Technical documentation, code identifiers, commit messages, API names, and code comments are **English**.

## 3. Locked Product Scope

### Crop scope

The implementation is deliberately bounded to two crops:

- **Rice / padi** for crop cycles, harvest prediction, leaf disease diagnosis, and soil guidance.
- **Guava / jambu biji** for orchard rejuvenation guidance, soil guidance, and relevant farm records.

The scientific notebook contains literature for many more crops. That broader literature is reference material, not permission to expand v1. A focused crop scope makes the features implementable and scientifically defensible.

Every feature must declare crop applicability. An invalid combination remains visible but returns **“Tidak Berlaku”** with a short scientific explanation. Do not silently hide invalid combinations and do not fabricate a prediction.

Examples:

- Rice rejuvenation guidance: not applicable.
- Guava rice-leaf disease classifier: not applicable.
- Guava rice harvest model: not applicable.
- Soil assessment: applicable when required inputs are provided, but state whether values are measured, manually entered, simulated, or location-derived.

### Current user-facing features

1. Rice harvest-time prediction.
2. Soil-condition analysis with nitrogen guidance.
3. Rice leaf-disease diagnosis.
4. Guava orchard rejuvenation guidance.
5. Offline AI and synchronization.

Offline AI is intentionally presented as a feature, even though technically it is a deployment capability reused by disease diagnosis and local rule execution. Farmland mapping was removed from the active product scope on 2026-10-13; its old prediction records remain readable as legacy history.

## 4. Feature Contracts

Every saved result must include: feature type, farm and crop cycle, input snapshot, output, confidence or reliability, assumptions, explanation, recommended action, model/rule version, provenance where external data was used, and UTC creation time.

### 4.1 Rice harvest-time prediction

Purpose: estimate a rice harvest date/window and current growth stage.

Inputs:

- Planting date.
- Rice variety or expected variety duration.
- Location.
- Optional weather history/forecast from a versioned NASA POWER adapter.
- Optional satellite-derived vegetation indices when available.

Outputs:

- Estimated harvest date or date range.
- Current/estimated growth stage.
- Reliability/confidence indicator.
- Assumptions and data freshness.
- Explanation and recommended next action.

Implementation guidance:

- Start with a transparent phenology/duration baseline that always works for seeded rice examples.
- Add a modest trained model only when its dataset, split, evaluation, and limitations are reproducible. A small school prototype must not present a generic foreign crop model as locally calibrated Indonesian rice AI.
- Online weather/satellite enrichment may improve the estimate, but cached/demo inputs must keep the school demonstration usable.
- Cloud cover, missing observations, variety differences, planting practice, and local climate must appear in limitations.

Primary scientific sources: `IRRI Rice Production Evidence Extract`, `Rice Phenology and Harvest-Prediction Evidence Extract`, NASA POWER Daily API documentation, and the early crop-classification/time-series research.

### 4.2 Soil-condition analysis and nitrogen guidance

Purpose: explain soil condition and provide bounded guidance based on user-entered or available contextual values.

Inputs:

- pH.
- Moisture.
- Nitrogen, phosphorus, and potassium values when measured or entered.
- Optional farm location for SoilGrids regional context and uncertainty.
- Crop and crop-cycle context.

Outputs:

- Soil-condition classifications.
- Input provenance: measured, manually entered, simulated, or location-derived.
- Nitrogen guidance and its assumptions.
- Regional baseline/uncertainty when SoilGrids is used.
- Clear recommendation to verify important decisions with proper soil testing.

Implementation guidance:

- SoilGrids is regional context, never a claimed laboratory measurement.
- V1 does not assume the user owns a spectrometer. A simulated sensor UI may be included for demonstration but must be labeled as simulation.
- Soil spectroscopy and NPK prediction may be explored as an ML extension. Do not claim portable Vis-NIR estimates replace wet-chemistry laboratory testing.
- A deterministic or hybrid advisory is valid. “All features work” does not mean six separate neural networks must be trained.

Primary scientific sources: the Semarang portable-spectrometer paper, the ORBi infrared spectroscopy review, USK spectroscopy research, Open Soil Spectral Library, and SoilGrids documentation.

### 4.3 Rice leaf-disease diagnosis

Purpose: classify supported rice leaf conditions from an image and explain uncertainty.

Inputs:

- Leaf image from upload/camera.
- Optional symptom text and environmental context for online enhancement.

Outputs:

- Supported disease/healthy class.
- Probability/confidence.
- Model version.
- Image-quality and out-of-distribution warnings.
- Explanation and safe next steps; this is not a definitive agronomist diagnosis.

Implementation guidance:

- This is the main genuinely trained ML feature.
- Prefer field-oriented rice data, especially Paddy Doctor, over relying only on controlled-background PlantVillage images.
- Use reproducible PyTorch training with fixed seeds, recorded provenance, stratified/group-aware splits, metrics, and exported artifacts.
- Detect duplicates and near-duplicates before splitting to avoid leakage.
- Export the accepted model to ONNX. Online backend and offline browser inference must use equivalent preprocessing and class labels.
- Do not claim published laboratory accuracy as field accuracy. Controlled-background models can collapse under real lighting, clutter, blur, and occlusion.

Primary scientific sources: Paddy Doctor paper/dataset, PlantDoc, PlantVillage bias paper, PlantSeg, AgriFusionNet multimodal paper, RootSense, and the Mohanty plant-disease project.

### 4.4 Guava orchard rejuvenation guidance

Purpose: recommend whether and how an aging guava orchard should be evaluated for rejuvenation.

Inputs:

- Crop must be guava.
- Orchard/tree age.
- Productivity decline.
- Canopy condition and optional management observations.

Outputs:

- Reliability-labeled recommendation such as monitor, rejuvenation candidate, seek expert inspection, or replacement consideration.
- Rule version and evidence basis.
- Pruning timing/height guidance only where the source supports it.
- Safety and local-expert caveat.

Implementation guidance:

- Implement as a versioned deterministic expert/rules engine. Deep learning is neither required nor justified by the current evidence.
- Keep species-specific thresholds. Do not generalize mango, litchi, or cashew rules to guava.
- The sources indicate guava orchard senility/rejuvenation commonly becomes relevant around 10–20 years, but recommendations depend on condition and local practice. Avoid presenting age alone as an automatic command to prune.

Primary scientific sources: `Rejuvenating old, senile orchards...` and `Assessment of Rejuvenation Technology...Old Guava Orchard`.

### 4.5 Retired: crop/farmland mapping

Removed from the active application scope on 2026-10-13 at the user's request. The former `/features/mapping` page and API are unavailable. Existing prediction rows remain in the database and history for auditability, labeled “Pemetaan Lahan (riwayat lama)”.

### 4.6 Offline AI and synchronization

Purpose: allow useful field behavior without an internet connection.

Offline-capable v1 behavior:

- Installable PWA shell.
- Explicit “Aktifkan AI Offline” flow that downloads the versioned ONNX disease model and required assets.
- Browser-local rice disease inference through ONNX Runtime Web.
- Cached crop profiles, rejuvenation/soil rules, and selected prior results.
- Local append-only prediction-result queue.
- Idempotent synchronization after reconnection.

Online-only behavior:

- Login and registration.
- Authoritative account/session checks.
- Farm and crop-cycle editing in v1.
- Live external-data retrieval and live imagery discovery.

Rules:

- Default ONNX Runtime Web execution provider is WebAssembly for compatibility. WebGPU is optional acceleration after capability detection.
- Store offline-created results in IndexedDB with a stable `client_operation_id`.
- Enforce database uniqueness on `(user_id, client_operation_id)` so replay produces exactly-once logical insertion.
- Retry network failures and 5xx responses with backoff. Treat validation/permission 4xx responses as terminal and visible.
- On 401/session expiry, retain queued results, request login, then resume synchronization.
- On `ACCOUNT_DISABLED`, retain local user-created results but deny synchronization until the account issue is resolved.
- Never store passwords, session tokens, JWTs, or cookie contents in localStorage or IndexedDB.
- Model download must show size/progress, verify version/hash, and preserve the previous working model until the replacement is complete.
- Configure Workbox precache size deliberately for model binaries.

## 5. Architecture and Technology Decisions

### Frontend

- React + TypeScript + Vite.
- Responsive PWA; phone and desktop browsers.
- React Router.
- TanStack Query for server-state fetching and non-sensitive read-model persistence.
- A dedicated IndexedDB mutation queue; TanStack Query cache is not the authoritative offline queue.
- ONNX Runtime Web for offline disease inference.
- Workbox/Vite PWA integration with explicit model caching and background-sync behavior.
- Vitest for unit/component logic and Playwright for critical end-to-end flows.

### Backend

- Python FastAPI.
- Modular routers, request/response schemas, services, repositories, domain logic, and external adapters.
- Pydantic schemas and explicit versioned API contracts.
- Synchronous SQLAlchemy 2 sessions with PyMySQL for school-project simplicity.
- Alembic is the only schema migration mechanism.
- Predictor interfaces are versioned so model/rule implementations can be replaced without rewriting API/domain code.
- pytest and FastAPI TestClient/httpx for backend testing.

### Database

- **MySQL 8.4 with `utf8mb4` from day one.**
- SQLite is not an application or integration-test substitute.
- Integration tests use an isolated Dockerized MySQL database and apply Alembic migrations from an empty database.
- Startup retries database connection for up to roughly 60 seconds using bounded exponential backoff; Compose ordering alone is insufficient.

### Packaging and hosting

- Docker Compose for frontend/reverse proxy, FastAPI backend, MySQL, and Cloudflare Tunnel/supporting services.
- Private Compose network.
- Named MySQL data volume and separate saved-image volume.
- Publish only the web entry point through Cloudflare Tunnel.
- MySQL and internal service ports must not be publicly exposed.
- Pin image/dependency versions; avoid floating `latest` tags.

## 6. Recommended Repository Shape

This structure is recommended, not yet created:

```text
Smart Farming/
├── HANDOFF.md
├── README.md
├── AGENTS.md
├── compose.yaml
├── .env.example
├── docs/
│   ├── adr/
│   ├── api/
│   ├── operations/
│   └── scientific-limitations.md
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── offline/
│   │   ├── routes/
│   │   └── services/
│   └── tests/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── domain/
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── predictors/
│   │   └── adapters/
│   ├── alembic/
│   └── tests/
├── ml/
│   ├── configs/
│   ├── data/
│   ├── training/
│   ├── evaluation/
│   └── export/
├── models/README.md
├── fixtures/
└── scripts/
```

Large datasets and trained model binaries must be downloaded or built by reproducible scripts and excluded from Git.

## 7. Domain Model

Minimum entities:

- `User`: name, email, password hash, optional phone, role, status, timestamps, and session/account version as needed.
- `Session`: opaque-token hash, user, expiry, rotation/revocation metadata, timestamps.
- `Farm`: owned by one farmer; a farmer may own multiple farms.
- `CropCycle`: belongs to a farm; crop, variety, planting date, area, location, optional soil inputs, lifecycle status, timestamps.
- `Prediction`: user, farm, crop cycle, feature type, model/rule version, input snapshot, output, confidence/reliability, assumptions, explanation, recommendation, provenance, timestamps, sync metadata, and optional client operation ID.
- `SavedImage`: optional authorized reference to a non-public stored image. Store only after explicit user opt-in.
- `AuditLog`: actor, action, target type/ID, metadata, timestamp.
- Agricultural reference tables/configuration as needed for rice varieties, crop profiles, rule versions, and supported disease classes.

Crop-cycle states:

`planned`, `planted`, `growing`, `harvest-ready`, `harvested`, `archived`

Use UTC in storage and localize dates/times in the UI.

## 8. Authentication, Accounts, and Authorization

Roles:

- `farmer`
- `admin`
- `superadmin`

Account rules:

- Farmers may self-register online.
- Admins may create and manage farmer accounts only.
- Superadmins may create/manage farmers and admins.
- Nobody publicly registers as admin or superadmin.
- Bootstrap the first superadmin through environment variables or a CLI command, never a public route.
- Superadmin-created admins receive an initial password during account creation.
- Accounts may be disabled while preserving farms, crop cycles, predictions, and audit history.
- Only superadmin can permanently delete accounts. Prefer anonymization or scheduled deletion when referential history would break.

Permission boundaries:

| Action | Farmer | Admin | Superadmin |
|---|---:|---:|---:|
| Manage own farms/cycles/results | Yes | No | No |
| View another farmer's records | No | No | No |
| Create/manage farmer accounts | No | Yes | Yes |
| Create/manage admin accounts | No | No | Yes |
| Manage agricultural reference data | No | Read-only | Read-only |
| Edit/delete farmer agricultural records | Own only | No | No |
| View audit logs | No | No | Yes |
| Permanently delete / anonymize accounts | No | No | Yes |

Authorization is backend-authoritative. Every protected object query must include role and ownership scope at database-query time. UUIDs and hidden frontend controls are not authorization.

### Session design

- Use cryptographically random opaque server-side sessions stored in MySQL, not browser-readable JWT authorization.
- Cookie contains the random token; database stores only a secure SHA-256 hash of the token.
- Cookie: `HttpOnly`, `SameSite=Lax`, `Path=/`, bounded expiry, `Secure` outside localhost, and no broad `Domain` attribute.
- Rotate session after login, password change, or role/privilege change.
- Revoke all sessions after password change, role change, or account disable.
- A disabled account returns HTTP 403 with machine code `ACCOUNT_DISABLED` and a neutral Indonesian message.
- Hash passwords with Argon2id using current OWASP-aligned parameters.
- Protect state-changing requests with a signed, session-bound double-submit CSRF token in a custom header and validate expected Origin/Host.
- Rate-limit login, registration, password change, and prediction upload endpoints.

## 9. Website Behavior and Pages

Required journeys/pages:

- Registration, login, logout, password change, disabled-account handling.
- Dashboard showing active farm, active crop cycle, alerts, recent predictions, and six feature shortcuts.
- Farm management.
- Crop-cycle management and lifecycle status.
- One page/wizard for each of the six features.
- Prediction result detail and history filtered by farm, cycle, date, and feature.
- Offline model installation/status, local queue status, and synchronization errors.
- Admin farmer-account management and agricultural-reference management.
- Superadmin admin management, audit log page, and agricultural-reference views.

Seeded demonstration data must include:

- A farmer account.
- A rice farm and active rice cycle.
- A guava farm and active guava/orchard cycle.
- Representative history for all applicable features.
- At least one “Tidak Berlaku” example.

Error states must distinguish connectivity failure, unavailable external data, invalid input, unsupported crop-feature pairing, model failure, and permission denial.

## 10. API and Service Boundaries

Exact routes may evolve, but keep these boundaries explicit:

- `/api/v1/auth/*`: registration, login, logout, current session, password change, account creation, and CSRF bootstrap.
- `/api/v1/farms/*` and `/api/v1/crop-cycles/*`.
- `/api/v1/predictions/*`: create, detail, history, idempotent sync.
- `/api/v1/features/harvest/*`.
- `/api/v1/features/soil/*`.
- `/api/v1/features/disease/*`.
- `/api/v1/features/rejuvenation/*`.
- `/api/v1/admin/*` and `/api/v1/superadmin/*`.
- `/api/v1/health/*`: liveness, readiness, model and dependency status as appropriate.

Keep scientific/domain calculations independent from FastAPI and SQLAlchemy. Each predictor/rule engine should accept typed domain input and return a typed versioned result.

External adapters:

- NASA POWER for weather context.
- SoilGrids for regional soil context and uncertainty.
- Copernicus STAC for optional scene discovery.

Each adapter needs explicit timeout, retry, caching, provenance, and unavailable-data behavior. Store retrieval timestamp/source in prediction input snapshots.

## 11. Image Privacy and Upload Safety

- Accept JPEG, PNG, and WebP only; maximum 10 MiB unless deliberately revised.
- Validate magic bytes independently of filenames.
- Decode with an image library; enforce pixel/dimension limits.
- Strip metadata and re-encode before inference or storage.
- Use generated UUID filenames.
- Temporary uploads live outside the webroot and are deleted after inference.
- Save an original/processed disease image only if the farmer explicitly selects “Simpan gambar”.
- Persisted images use a separate non-public volume and are served through an authorized endpoint.
- Offline browser inference must not upload the image.

## 12. Deployment and Operations

Target: the user's old self-hosted Linux laptop, reachable through an existing Cloudflare Tunnel.

Topology:

```text
Browser/PWA
    |
Cloudflare HTTPS + Tunnel
    |
frontend/reverse proxy (only published origin)
    |
FastAPI ---- MySQL 8.4
    |          |
model/data   named persistent volume
saved-image volume
```

Mandatory rules:

- Run `cloudflared` with the official image and a token supplied outside Git.
- Trust forwarded headers only from the known internal proxy/tunnel path; never trust arbitrary client `X-Forwarded-*` headers.
- Configure the expected external HTTPS origin explicitly for redirects, secure cookies, CSRF origin checks, and generated URLs.
- Store secrets in owner-readable files outside the repository and expose them through Compose secrets or referenced environment files.
- Never bake credentials, tunnel tokens, or superadmin bootstrap secrets into images or source control.
- Add container health checks and restart policies.
- Keep MySQL and backend internal ports private.
- Configure Docker JSON log rotation at approximately 10 MiB with five files per container.

Backups and old-laptop safeguards:

- Logical MySQL backup daily.
- Retain seven daily and four weekly generations.
- Keep at least one encrypted copy outside the laptop.
- Test restoration weekly into a disposable database; a scheduled backup without restore verification is incomplete.
- Point-in-time recovery/binlogs are optional for this school project; document possible loss since the latest backup.
- Alert at 80% disk usage. At 90%, stop optional image saves and dataset/model downloads before core persistence fails.
- Never automatically prune named Docker volumes.
- Apply OS/container updates after a verified backup and restore check.

Health/status checks should cover public HTTP, backend readiness, MySQL connectivity, required model availability, last successful backup, and disk capacity.

Deployment-specific values still need discovery during implementation: public app hostname, current Tunnel configuration/service name, internal proxy choice, available CPU/RAM/GPU, backup destination, and desired maintenance window.

## 13. Testing and Acceptance

### Required automated coverage

- Authentication and session lifecycle.
- Full role/action matrix.
- Farmer ownership isolation at repository and API layers.
- Session rotation, expiry, password/role change, and disable revocation.
- Cookie attributes, CSRF rejection, and Origin validation.
- Alembic migrations from empty MySQL to head.
- Each feature's valid and not-applicable contracts.
- Model/rule version persistence.
- Image retention opt-in and temporary-file deletion.
- Offline model installation, browser restart, and true airplane-mode inference.
- IndexedDB queue persistence, duplicate replay, 5xx retry, 4xx terminal handling, 401 re-login recovery, and exactly-once sync.
- Responsive critical flows with Playwright mobile and desktop viewports.

### Release acceptance checklist

- Three-role account creation follows the exact policy.
- Changing a URL/API identifier cannot expose another farmer's records.
- All six features produce honest, understandable seeded demonstrations.
- Results survive service and laptop restarts.
- Offline rice disease diagnosis works after one explicit online model download.
- An offline-created result synchronizes exactly once after reconnection.
- The site works on phone and desktop through Cloudflare Tunnel.
- MySQL is not publicly reachable.
- Backup restoration has been successfully tested.
- Errors identify connectivity, input, external data, model, crop applicability, or permissions rather than showing a generic failure.
- Scientific limitations are visible in the UI/presentation.

## 14. Delivery Sequence

Use vertical slices; do not build all infrastructure first and postpone the visible product.

### Phase 0: Baseline and decisions

- Initialize Git and repository structure.
- Record runtime versions and pin dependencies.
- Inspect laptop resources and existing Cloudflare/Docker setup.
- Create ADRs for session auth, offline queue, MySQL-only tests, and model delivery.
- Add Compose with MySQL and minimal health checks.

Completion: empty-database migration and minimal frontend/backend health flow work locally.

### Phase 1: Accounts and farm-cycle core

- Implement users, sessions, RBAC, farms, crop cycles, audit log, seed data.
- Implement Indonesian auth/dashboard/farm/cycle flows.
- Test ownership and role boundaries before feature work.

Completion: farmer/admin/superadmin journeys pass the role matrix and persisted data survives restart.

### Phase 2: Deterministic vertical slices

- Guava rejuvenation rules.
- Soil-condition classification/guidance with manual values.
- Harvest baseline using rice variety duration and transparent assumptions.
- Uniform prediction-result storage and history.

Completion: three applicable features and not-applicable states work end to end with versioned results.

### Phase 3: Disease ML online

- Reproducible dataset preparation and leakage checks.
- Train/evaluate a lightweight rice disease model.
- Backend inference and safe image-upload flow.
- Export preprocessing/class metadata with the model.

Completion: evaluation report, reproducible command, versioned artifact, and online UI flow are demonstrable.

### Phase 4: Offline AI

- ONNX export parity tests.
- Explicit model installer, service worker caching, browser inference.
- IndexedDB append-only queue and idempotent sync.
- Airplane-mode Playwright scenarios.

Completion: install once, restart browser, diagnose offline, save result, reconnect, and sync exactly once.

### Phase 5: Mapping (retired)

This planned phase is superseded by the 2026-10-13 decision to remove farmland mapping from the active application. Do not reimplement it without explicit user approval.

### Phase 6: Self-host release

School Compose hardening from `IMPLEMENTATION-GOAL.md` Phase 6 is implemented (HSTS on the public host only, adapters with fallback, backup drill, retention, metrics). Remaining owner work is the public incognito rehearsal and physical-device PWA install.

- Harden Compose, proxy headers, CSP, rate limiting, secret mounts, health checks, logs, and backups.
- Deploy through Cloudflare Tunnel.
- Run mobile/desktop, restore, restart, security-boundary, and offline acceptance checks.

Completion: the release acceptance checklist passes on the actual laptop.

## 15. NotebookLM Knowledge Bases

NotebookLM is the project's external knowledge base. It is already authenticated on this laptop and integrated with both Codex and Cursor CLI.

### Notebook routing

| Notebook | ID | Use it for |
|---|---|---|
| AgriFusionNet Scientific Knowledge Base | `b21202c8-803f-480f-8121-ff682d697ca4` | Agronomy, datasets, model claims, crop applicability, input/output validity, scientific limits |
| AgriFusionNet Web Implementation | `48fa3fa0-080e-4c2b-af53-391058efca40` | Stack, code contracts, MySQL/ORM, frontend/backend patterns, offline implementation, testing |
| AgriFusionNet Website System & Operations | `31eb4c9d-b5a4-4e1c-a9af-bbf7cc5e77e1` | User behavior, roles, security, Cloudflare/self-hosting, uploads, backups, monitoring, incidents |

Other notebooks (`UIB`, CSCA, and the untitled notebook) are unrelated and must not be used for AgriFusionNet implementation.

### Authority order inside notebooks

Scientific decisions:

1. `AgriFusionNet Scientific Scope and Evidence Rules`.
2. Rice-specific evidence extracts.
3. Primary papers/dataset documentation.
4. General or preprint literature, with limitations.

Implementation decisions:

1. `AgriFusionNet Code Implementation Contract`.
2. `AgriFusionNet Repository Planning Decisions Supplement`.
3. Official framework/library documentation.

Website/operations decisions:

1. `AgriFusionNet Website Behavior and Operations Specification`.
2. `AgriFusionNet Self-Host Security and Operations Decisions`.
3. OWASP, Cloudflare, Docker, MySQL, MDN, and Workbox documentation.

If a broad research answer conflicts with the implementation contract—for example, proposing many crops instead of rice and guava—the contract wins.

### NotebookLM CLI

Installed commands:

```bash
notebooklm doctor
notebooklm list --json
notebooklm source list -n <notebook-id> --json
notebooklm source get -n <notebook-id> <source-id>
notebooklm source fulltext -n <notebook-id> <source-id>
notebooklm ask -n <notebook-id> --json "your grounded question"
```

Inspect `--help` before using source-add or destructive commands. Avoid `notebooklm ask --new` unless intentionally deleting the notebook's current server-side conversation; normal targeted asks do not require it.

Example scientific query:

```bash
notebooklm ask -n b21202c8 --json \
  "For rice disease diagnosis, compare Paddy Doctor and PlantVillage for field validity. Cite sources, identify licensing/provenance checks, and propose a school-sized training/evaluation plan without overstating accuracy."
```

Example implementation query:

```bash
notebooklm ask -n 48fa3fa0 --json \
  "Using the Code Implementation Contract and Planning Decisions Supplement as authority, propose the SQLAlchemy models and Alembic migration order for users, sessions, farms, crop cycles, predictions, saved images, and audit logs. Mark any inferred field."
```

Example operations query:

```bash
notebooklm ask -n 31eb4c9d --json \
  "Using the two AgriFusionNet operations specifications as authority, produce a Cloudflare Tunnel and Compose pre-deployment checklist. Separate known decisions from values that must be inspected on this laptop."
```

### MCP use from Codex

The global MCP server is named `notebooklm`. It exposes 33 tools, including:

- `notebook_list`, `notebook_describe`
- `source_list`, `source_read`, `source_add`, `source_wait`
- `chat_ask`, `chat_configure`, `suggest_prompts`
- notebook/research/studio/share management tools

Ask explicitly for the MCP tool when grounding implementation decisions, for example:

```text
Use notebooklm chat_ask on AgriFusionNet Web Implementation. Treat the Code Implementation Contract and Repository Planning Decisions Supplement as authoritative. What are the exact offline synchronization invariants?
```

Codex on this laptop is launched through `/home/brian/.local/bin/codex`, a small wrapper that supplies a `medium` reasoning override required by a Codex 0.150.1 MCP-discovery quirk. Leave the wrapper in place unless a later Codex release is verified to work without it.

### MCP use from Cursor CLI

Cursor CLI is configured globally in `~/.cursor/mcp.json`, and `notebooklm` is approved.

Useful checks:

```bash
agent mcp list
agent mcp list-tools notebooklm
agent -p --mode ask --approve-mcps \
  "Use the notebooklm notebook_list MCP tool. Return only notebook titles."
```

In an interactive Cursor Agent session, explicitly name the notebook and ask for citations/uncertainties. MCP access is a research aid; the repository and this handoff remain the implementation record.

### Adding or refreshing sources

Add sources only to the notebook matching their role:

- Scientific paper/dataset/agronomic guidance → Scientific Knowledge Base.
- Official code/framework/API documentation → Web Implementation.
- Hosting/security/backup/Cloudflare operational guidance → Website System & Operations.

Before adding a source:

1. Prefer primary research, official dataset pages, and official vendor/framework documentation.
2. Check whether an equivalent source already exists.
3. Record why the source changes or strengthens a decision.
4. Wait for processing and confirm status is `ready`.
5. Update this handoff or an ADR if the source causes a settled decision to change.

Do not treat NotebookLM's prose as automatically correct. Require source citations, inspect the cited passages for important claims, and keep the distinction between evidence, recommendation, and settled project choice.

## 16. Source Map: What to Read for What

| Question | Notebook | Start with |
|---|---|---|
| Exact product/crop/feature scope | Web Implementation | Code Implementation Contract; Planning Decisions Supplement |
| Rice harvest evidence | Scientific | Rice Phenology and Harvest-Prediction Evidence Extract; IRRI extract; NASA POWER docs |
| Soil condition/NPK limitations | Scientific | ORBi spectroscopy review; Semarang/USK papers; Open Soil Spectral Library; SoilGrids |
| Rice disease data/model | Scientific | Paddy Doctor; PlantDoc; PlantVillage bias; AgriFusionNet and RootSense papers |
| Guava rejuvenation rules | Scientific | Old-orchard rejuvenation review; old-guava participatory study |
| ONNX browser inference | Web Implementation | ONNX Runtime Web and deployment docs; PyTorch ONNX docs |
| PWA cache/offline queue | Web Implementation + Operations | Vite PWA; Workbox precaching/background sync; TanStack persistence; project supplements |
| MySQL/SQLAlchemy/Alembic | Web Implementation | Planning Decisions Supplement; MySQL 8.4; SQLAlchemy MySQL dialect; Alembic docs |
| RBAC/session security | Web Implementation + Operations | Project contracts; OWASP Authorization, Session Management, Password Storage, CSRF |
| Cloudflare/self-host deployment | Operations | Self-Host Security and Operations Decisions; Cloudflare Tunnel/headers; FastAPI proxy docs |
| Upload privacy/safety | Operations | Project operations specs; OWASP File Upload |
| Backup/restore/health | Operations | Project self-host decisions; MySQL backup/recovery; Docker Compose health/restart/volume docs |

## 17. Scientific Honesty and Non-Goals

- This is not a production agronomy service, regulated diagnostic tool, or guarantee of harvest/yield.
- Do not claim published benchmark accuracy as this system's field accuracy.
- Do not imply every feature uses a neural network. The correct implementation is mixed: trained ML, deterministic rules, geospatial processing, adapters, and offline systems engineering.
- Offline AI reuses the disease model; it is not a sixth separately trained model.
- Do not claim SoilGrids or spectral estimates are laboratory measurements.
- Do not make rejuvenation recommendations across species using guava rules.
- Do not add a native Android app in v1.
- Do not expand beyond rice and guava without explicit user approval and supporting evidence.
- Do not require live satellite downloads for the core school demonstration.
- Do not store uploaded disease images by default.
- Do not use SQLite to simplify tests.
- Do not expose internal database/backend ports through the tunnel.

## 18. Settled Decisions from the Cursor Context Grill

The staged Cursor grill queried the Scientific, Website System & Operations, and Web Implementation notebooks and settled these decisions:

- Crop scope is rice and guava only. The current demonstrated features are rice harvest prediction, soil condition and nitrogen guidance, rice leaf disease diagnosis, guava rejuvenation guidance, and offline AI with synchronization. Farmland mapping was retired from the application on 2026-10-13.
- Disease v1 is visual-only for inference. Optional symptom or weather context may be stored for history but is not required by the model. Unsupported or low-confidence input returns “Tidak dapat diklasifikasi dengan andal” rather than a forced label.
- Seed rice varieties are Ciherang, IR64, and Inpari 32. Durations are transparent approximate priors, not local calibration.
- Disease classes must be finalized only after dataset provenance and license review; use a permitted Paddy Doctor-aligned subset with healthy and adequately represented field-relevant classes.
- Offline disease inference targets a MobileNetV3-Small-class model, INT8 ONNX at 20 MB or less, WASM by default, optional WebGPU, and a validation-tuned unknown threshold.
- Farmer self-registration is enabled for the demo but controlled by ALLOW_FARMER_SELF_REGISTRATION; admin-created farmers and superadmin-created admins remain supported.
- Managed account creation assigns the initial password directly in the admin form; setup-token delivery and SMTP are not required.
- The first superadmin is bootstrapped idempotently from mounted Compose secrets when no superadmin exists; credentials never belong in Git or migrations.
- SoilGrids is optional regional context from a local cache for one configured demo region. Core soil inputs remain user-entered, measured, or simulated, and missing regional context never blocks analysis.
- Account removal anonymizes by default, revokes sessions, blocks login, retains dependent records, and permits hard deletion only when safe or after the retention window with superadmin audit.
- Demo retention defaults are: no automatic purge for farm, cycle, or prediction records; 12 months for audit logs; 180 days for opt-in saved disease images; and 90 days before eligible hard deletion of anonymized accounts. All are configurable.

## 19. Deferred Implementation Discovery

These are implementation-time discovery items, not product-design blockers:

- Public hostname and current Cloudflare Tunnel ingress configuration.
- CPU, RAM, storage, and any usable GPU on the laptop.
- Backup destination outside the laptop.
- Branding, color system, logo, and final Indonesian copy tone.
- Exact persistent volume paths, trusted proxy subnet, and model disk footprint for host alerts.

Planning is sufficiently complete to begin. The next agent should not restart product discovery. It should inspect the laptop/repository, confirm runtime constraints, initialize the project, and implement Phase 0 followed by the account/farm-cycle vertical slice.

When new uncertainty appears, route it correctly:

- Scientific truth → Scientific Knowledge Base.
- Code/architecture choice → Web Implementation notebook and official docs.
- User behavior/security/deployment → Website System & Operations notebook.
- Product preference not established by evidence → ask the user.

Keep this file current when a locked decision changes. Record durable technical choices as ADRs rather than allowing chat history to become the only source of truth.
