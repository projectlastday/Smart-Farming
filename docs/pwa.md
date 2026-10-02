# PWA installability

Vite PWA plugin emits `/manifest.webmanifest` and a service worker.

Verified in Playwright Chromium (`e2e/pwa-installability.spec.ts`), not on a physical Android/iOS device:

- `name` / `short_name` AgriFusionNet
- `display: standalone`, `start_url: /`, `scope: /`, `lang: id`
- `theme_color` `#2d5016`, `background_color` `#f4f7f0`
- PNG icons 192 and 512, including `purpose: maskable`
- `navigator.serviceWorker.ready` after `/`

**Written decision:** Chromium + Playwright is the automated stand-in for “device-style” installability in this school repo. A real Add-to-Home-Screen tap on a phone is an owner pre-presentation step (`IMPLEMENTATION-GOAL.md` §8) and is not claimed as executed here.

Icons: `frontend/public/pwa-192.png`, `pwa-512.png`. Update prompt: `PwaUpdateBanner` (does not wipe in-progress forms).
