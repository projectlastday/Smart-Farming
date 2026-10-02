import { test, expect } from '@playwright/test';
import { loginAsDemo } from './session';

async function assertNoPageOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test.describe('Analisis Tanaman prediction list', () => {
  for (const viewport of [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'mobile-375', width: 375, height: 812 },
  ] as const) {
    test(`${viewport.name} lists every prediction with a Buka action`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await loginAsDemo(page);
      await page.goto('/analysis');

      await expect(page.getByRole('heading', { name: 'Analisis Tanaman' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Daftar prediksi' })).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'Lahan' })).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'Siklus Tanam' })).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'Fitur' })).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'Status hasil' })).toBeVisible();
      await expect(page.getByLabel('Dari tanggal')).toBeVisible();
      await expect(page.getByLabel('Sampai tanggal')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Analisis semua yang tersedia' })).toHaveCount(0);

      const rows = page.getByRole('row').filter({ has: page.getByRole('link', { name: 'Buka' }) });
      await expect(rows.first()).toBeVisible({ timeout: 15_000 });
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThan(0);
      for (let index = 0; index < rowCount; index += 1) {
        await expect(rows.nth(index).getByRole('link', { name: 'Buka' })).toHaveCount(1);
      }

      await rows.first().getByRole('link', { name: 'Buka' }).click();
      await expect(page).toHaveURL(/\/predictions\/[0-9a-f-]+$/i);
      await expect(page.getByRole('heading', { name: 'Detail Prediksi' })).toBeVisible();
      await assertNoPageOverflow(page);
    });
  }
});
