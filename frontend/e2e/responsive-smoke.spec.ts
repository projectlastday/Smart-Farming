import { test, expect, type Page } from '@playwright/test';
import { loginAsDemo } from './session';

const AUTH_ROUTES = ['/login', '/register'] as const;
const APP_ROUTES = [
  '/dashboard',
  '/analysis',
  '/farms',
  '/crop-cycles',
  '/predictions',
  '/features/harvest',
  '/features/soil',
  '/features/disease',
  '/features/rejuvenation',
  '/features/mapping',
  '/features/offline',
] as const;

const VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

async function login(page: Page) {
  await loginAsDemo(page);
}

async function assertNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
    };
  });
  expect(
    overflow.scrollWidth,
    `horizontal overflow ${overflow.scrollWidth} > ${overflow.clientWidth}`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test.describe('Responsive route smoke', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} auth pages do not overflow`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const route of AUTH_ROUTES) {
        await page.goto(route);
        await expect(page.locator('h1')).toBeVisible();
        await assertNoPageOverflow(page);
        await page.screenshot({
          path: `test-results/responsive-${viewport.name}${route.replaceAll('/', '-')}.png`,
          fullPage: true,
        });
      }
    });
  }

  test('mobile menu and list pages stay in viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page);

    const menu = page.getByRole('button', { name: 'Menu' });
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(page.getByRole('link', { name: 'Siklus Tanam' })).toBeVisible();
    await page.getByRole('link', { name: 'Lahan', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Kelola Lahan' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Filter dan paginasi' })).toBeVisible();
    await assertNoPageOverflow(page);

    await page.goto('/crop-cycles');
    await expect(page.getByRole('heading', { name: 'Siklus Tanam' })).toBeVisible();
    await expect(page.locator('td', { hasText: /^rice$/i })).toHaveCount(0);
    await expect(page.locator('td', { hasText: /^guava$/i })).toHaveCount(0);
    await expect(page.locator('.badge', { hasText: /^growing$/i })).toHaveCount(0);
    await assertNoPageOverflow(page);

    await page.goto('/predictions');
    await expect(page.getByRole('heading', { name: 'Riwayat Prediksi' })).toBeVisible();
    await assertNoPageOverflow(page);
    await page.screenshot({ path: 'test-results/responsive-mobile-375-predictions.png', fullPage: true });
  });

  test('desktop and mobile feature routes do not overflow', async ({ page }) => {
    await login(page);
    for (const viewport of [
      { name: 'mobile-375', width: 375, height: 812 },
      { name: 'desktop', width: 1280, height: 800 },
    ] as const) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const route of APP_ROUTES) {
        await page.goto(route);
        await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 });
        await assertNoPageOverflow(page);
        if (viewport.name === 'mobile-375' || viewport.name === 'desktop') {
          await page.screenshot({
            path: `test-results/responsive-${viewport.name}${route.replaceAll('/', '-')}.png`,
            fullPage: true,
          });
        }
      }
    }
  });
});
