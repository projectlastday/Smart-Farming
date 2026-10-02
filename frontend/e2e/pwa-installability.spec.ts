import { test, expect } from '@playwright/test';
import { loginAsDemo } from './session';

test.describe('PWA installability', () => {
  test('manifest, icons, theme, and service worker', async ({ page, request }) => {
    test.setTimeout(90_000);
    const manifestRes = await request.get('/manifest.webmanifest');
    expect(manifestRes.ok(), `manifest HTTP ${manifestRes.status()}`).toBeTruthy();
    const manifest = (await manifestRes.json()) as {
      name: string;
      short_name: string;
      start_url: string;
      display: string;
      theme_color: string;
      background_color: string;
      icons: { src: string; sizes: string; type: string; purpose?: string }[];
    };
    expect(manifest.name).toBe('AgriFusionNet');
    expect(manifest.short_name).toBe('AgriFusionNet');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toMatch(/^\//);
    expect(manifest.theme_color).toBe('#2d5016');
    expect(manifest.background_color).toBe('#f4f7f0');
    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    for (const icon of manifest.icons) {
      const href = icon.src.startsWith('http') ? icon.src : new URL(icon.src, manifestRes.url()).toString();
      const iconRes = await request.get(href);
      expect(iconRes.ok(), `icon ${icon.src} HTTP ${iconRes.status()}`).toBeTruthy();
      expect(iconRes.headers()['content-type'] ?? '').toMatch(/image\/png/);
    }

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'AgriFusionNet' })).toBeVisible();
    const swState = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return 'unsupported';
      const timeout = new Promise<string>((resolve) => {
        window.setTimeout(() => resolve('timeout'), 20_000);
      });
      const ready = navigator.serviceWorker.ready.then((reg) =>
        reg.active || reg.waiting || reg.installing ? 'ready' : 'empty',
      );
      return Promise.race([ready, timeout]);
    });
    expect(swState).toBe('ready');
  });

  test('standalone display mode keeps the login heading', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addInitScript(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
          matches: query.includes('display-mode: standalone') ? true : false,
          media: query,
          onchange: null,
          addEventListener() {},
          removeEventListener() {},
          addListener() {},
          removeListener() {},
          dispatchEvent() {
            return false;
          },
        }),
      });
    });
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'AgriFusionNet' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
  });

  test('installed-style dashboard still renders after login', async ({ page }) => {
    await loginAsDemo(page);
    await expect(page.getByRole('heading', { name: /Selamat datang/i })).toBeVisible();
  });
});
