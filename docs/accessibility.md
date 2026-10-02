# Accessibility (v1)

Measured in unit tests and Playwright (`e2e/accessibility.spec.ts`).

| Check | Evidence |
|---|---|
| Contrast ≥ 4.5:1 | Tokens `#1e2a16` / `#3d4a36` on `#f4f7f0` and `#ffffff`; `frontend/tests/contrast.test.ts` |
| Target size ≥ 44px | Buttons, toolbar controls, autocomplete options `min-height: 2.75rem`; login Masuk bounding box in e2e |
| Zoom / reflow 200% | Login at 640×400 (200% of 1280 width) with no horizontal overflow |
| Reduced motion | `prefers-reduced-motion: reduce` zeros transitions; e2e probes `.progress-bar-fill` |
| Screen-reader labels | Visible `label` on forms; skip links; menu `aria-label` / `aria-expanded`; login/register `role="alert"` |

Unauthenticated pages include a skip link to the form. Authenticated shell skip link is “Lewati ke konten”.

Confirm dialogs (`ConfirmDialog`) are Escape-closable, move focus to **Batal** when opened, and restore the previously focused control when closed (`frontend/tests/confirm-dialog.test.tsx`).

Not a WCAG certification. No third-party screen-reader lab; NVDA/VoiceOver on a physical device remains an owner manual check.
