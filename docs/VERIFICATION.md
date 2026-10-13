# AgriFusionNet Verification Report

Date: 2026-09-01 (completion audit against current repository + prior automated evidence)

Stack target: **http://127.0.0.1:8005** (Compose proxy). Public origin: `https://sf.projectdunia.my.id`.

Physical Add-to-Home-Screen, public incognito walkthrough (`IMPLEMENTATION-GOAL.md` DoD / §8 owner steps), and NVDA/VoiceOver on a real device remain **owner-manual**. This report does not claim those. The 21 §8 behavioral checkboxes are marked from the automated coverage table below; that is not an incognito public rehearsal.

## Completion audit (2026-09-01)

Authoritative prior evidence (already recorded below): backend pytest **114 passed**, Playwright desktop **80** + mobile **80**, goal-acceptance, smoke, Compose persistence, public HSTS/CSP/X-CTO. This round inspected source/tests against `IMPLEMENTATION-GOAL.md` and fixed two remaining honesty/accessibility gaps:

| Finding | Resolution | Evidence this round |
|---------|------------|---------------------|
| Compact Analisis/Riwayat showed a leftover `confidence` percentage as “Perkiraan kepercayaan” even for rule results | `compactReliabilityCaption` / `historyReliabilityLabel` require `reliability.kind`; model probability vs rule completeness vs not-applicable | `frontend/tests/reliability.test.ts`, `analysis-page.test.tsx`, `predictions-history-page.test.tsx` |
| Confirm dialog was keyboard-closable but did not restore focus | Focus cancel on open; restore previously focused control on close | `frontend/tests/confirm-dialog.test.tsx` |

```bash
cd frontend && npm test && npm run typecheck
```

**Result:** **111 passed** (26 files) + `tsc --noEmit`. Backend pytest, Playwright, smoke, and persistence were not re-run this round; the gaps were frontend-only.

## Commands run (2026-09-01 demo-gate)

```bash
docker compose ps
cd backend && .venv/bin/pytest -q
cd frontend && npm test && npm run typecheck
cd frontend && npx playwright test e2e/goal-acceptance.spec.ts --project=desktop-chromium --workers=1
cd frontend && npx playwright test --project=desktop-chromium --workers=1
cd frontend && npx playwright test --project=mobile-chrome --workers=1
bash scripts/smoke.sh
bash scripts/verify_compose_persistence.sh
```

Playwright used default `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8005`. Credentials were not printed.

## Results

| Suite | Command | Result |
|-------|---------|--------|
| Backend pytest | `cd backend && .venv/bin/pytest -q` | **114 passed** (48.68s) — demo-gate round |
| Frontend unit | `cd frontend && npm test` | **111 passed** (26 files) — completion-audit round |
| Frontend typecheck | `cd frontend && npm run typecheck` | pass |
| Goal-acceptance (desktop) | `npx playwright test e2e/goal-acceptance.spec.ts --project=desktop-chromium` | **9 passed** |
| Playwright desktop | `npx playwright test --project=desktop-chromium --workers=1` | **80 passed** (2.1m) |
| Playwright mobile | `npx playwright test --project=mobile-chrome --workers=1` | **80 passed** (2.7m) |
| Smoke | `bash scripts/smoke.sh` | **SMOKE OK** |
| Compose restart persistence | `bash scripts/verify_compose_persistence.sh` | **compose restart persistence OK** |
| Health | Compose `backend`/`frontend`/`mysql` healthy; proxy `:8005` | ok |

## Goal-acceptance coverage (automated, local Compose unless noted)

| Item | Evidence |
|------|----------|
| Demo farms rice + guava, no E2E residue | `goal-acceptance` demo farms test |
| Known-good blast classification | `goal-acceptance` online disease + `app.spec` disease flow |
| Overdue harvest stage + actual harvest delta | `goal-acceptance` overdue harvest test |
| History beyond 100 | `goal-acceptance` prediction history test |
| Farmer cannot read another farmer's farm/cycle/prediction | `goal-acceptance` ownership test |
| Admin create farmer, cannot create admin; superadmin creates admin with password | `goal-acceptance` admin/superadmin test |
| Query error shows retry, not empty state | `goal-acceptance` farms 500 + `CropCyclesPage` / `AnalysisPage` vitest |
| Public HSTS/CSP/X-CTO; local HTTP has no HSTS | `goal-acceptance` public HTTPS headers test |
| HTML body does not leak env secret names | same public HTML assertion |
| Offline install, reload, infer, queue, sync once | `offline-disease.spec.ts` desktop+mobile |
| Mobile overflow | `responsive-smoke`, `admin-responsive`, `qa-audit` |
| Console/API errors on happy path | `qa-audit.spec.ts` |
| New managed accounts can log in with their administrator-assigned password | `backend/tests/test_integration.py` + `goal-acceptance` |

## Product fixes verified this round

| Finding | Resolution |
|---------|------------|
| Compact analysis/history treated leftover `%` as model probability | Reliability kind required; rule results show `Keandalan aturan` |
| Confirm dialog did not restore focus | Focus cancel on open; restore trigger on close |
| Crop-cycle list treated query failure as empty | Error + **Coba lagi** on `CropCyclesPage` |
| Analysis prediction-load error had no retry | Retry on `AnalysisPage` |
| New admin/farmer could not log in without a setup token | Password is assigned during account creation |
| No audit log UI despite `GET /api/v1/admin/audit` | `AdminAuditPage` at `/admin/audit` (superadmin) |
| `HANDOFF.md` role table disagreed with farms scoped to `farmer_id` | Matrix updated: admin/superadmin do not see other farmers' farms/cycles |
| `scripts/smoke.sh` still grepped old disease version id | Expects `disease-mobilenet-v1-paddy-doctor` |

## Remaining owner-manual items

1. Incognito walkthrough on `https://sf.projectdunia.my.id` (`IMPLEMENTATION-GOAL.md` §8). Local Playwright is not a substitute.
2. Physical-device Add-to-Home-Screen.
3. NVDA or VoiceOver on a real device (login + dashboard).

## Remaining product limitations (not claimed fixed)

1. Farmland mapping was removed from the current product scope; historical mapping prediction records remain available in history.
2. Admin reference is server-sourced and read-only in v1 (no public CRUD).
3. ONNX Runtime WASM may log CDN fallback warnings in some browsers (functional fallback works).
4. pip-audit findings deferred in `docs/security-scanning.md`.

## Historical: 2026-08-29 (third exhaustive audit)

That session targeted **http://127.0.0.1:8080** and older pass counts (backend 57, frontend unit 8, Playwright 31+31). Disease was still described as a TinyCNN demo in that write-up; the current model is Paddy Doctor MobileNetV3-Small. See git history of this file for the original command log.

## Historical: 2026-09-01 — Public PWA installability (Playwright Chromium)

```bash
PLAYWRIGHT_BASE_URL=https://sf.projectdunia.my.id npx playwright test e2e/pwa-installability.spec.ts --project=desktop-chromium --workers=1
```

**Result:** 3 passed. Automated Chromium check of manifest, icons, theme, and service worker on the public origin. Does not claim physical Add-to-Home-Screen or the §8 owner incognito walkthrough.
