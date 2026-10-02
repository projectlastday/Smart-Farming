import { test, expect, type Page } from '@playwright/test';
import { loginAsSuperadmin } from './session';

const VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

async function loginSuperadmin(page: Page) {
  await loginAsSuperadmin(page);
}

async function assertNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
  expect(
    overflow.scrollWidth,
    `horizontal overflow ${overflow.scrollWidth} > ${overflow.clientWidth}`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

async function assertComfortableTarget(locator: ReturnType<Page['getByRole']>) {
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  expect(box!.height).toBeGreaterThanOrEqual(40);
  expect(box!.width).toBeGreaterThanOrEqual(40);
}

async function openMobileMenuIfPresent(page: Page) {
  const menu = page.getByRole('button', { name: 'Menu' });
  if (await menu.isVisible()) {
    await menu.click();
  }
}

test.describe('Admin and Referensi responsive smoke', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} admin farmer page and reference page`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await loginSuperadmin(page);

      await openMobileMenuIfPresent(page);
      await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Referensi' })).toBeVisible();
      if (viewport.width <= 768) {
        await assertComfortableTarget(page.getByRole('button', { name: /Menu|Tutup menu/ }));
      }

      await page.goto('/admin/farmers');
      await expect(page.getByRole('heading', { name: 'Kelola Akun Petani' })).toBeVisible();
      await expect(page.getByLabel('Nama')).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();
      await expect(page.getByLabel('Telepon')).toBeVisible();
      await expect(page.getByLabel('Kata Sandi', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Konfirmasi Kata Sandi')).toBeVisible();
      await expect(page.getByLabel('Peran')).toBeVisible();
      const submit = page.getByRole('button', { name: 'Buat Akun' });
      await expect(submit).toBeVisible();
      await assertComfortableTarget(submit);
      await page.getByLabel('Nama').focus();
      await expect(page.getByLabel('Nama')).toBeFocused();
      await assertNoPageOverflow(page);
      await page.screenshot({
        path: `test-results/responsive-${viewport.name}-admin-farmers.png`,
        fullPage: true,
      });

      await page.goto('/admin/reference');
      await expect(page.getByRole('heading', { name: 'Admin — Referensi Pertanian' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Referensi pertanian' })).toBeVisible();
      await expect(page.getByText(/Ciherang|Varietas/i).first()).toBeVisible();
      await expect(page.getByRole('cell', { name: /^stub$/i })).toHaveCount(0);
      await assertNoPageOverflow(page);
      await page.goto('/admin/audit');
      await expect(page.getByRole('heading', { name: 'Log Audit' })).toBeVisible();
      await assertNoPageOverflow(page);
      await page.screenshot({
        path: `test-results/responsive-${viewport.name}-admin-audit.png`,
        fullPage: true,
      });
    });
  }
});
