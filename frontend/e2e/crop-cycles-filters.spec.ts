import { test, expect, type Page } from '@playwright/test';
import { loginAsDemo } from './session';

async function login(page: Page) {
  await loginAsDemo(page);
}

async function assertNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test.describe('Siklus Tanam filters', () => {
  for (const viewport of [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'mobile-375', width: 375, height: 812 },
  ] as const) {
    test(`${viewport.name} explicit filters and no overflow`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await login(page);
      await page.goto('/crop-cycles');
      await expect(page.getByRole('heading', { name: 'Siklus Tanam' })).toBeVisible();
      await expect(page.getByLabel('Cari siklus')).toHaveCount(0);

      const lahan = page.getByRole('combobox', { name: 'Lahan' });
      const tanaman = page.getByRole('combobox', { name: 'Tanaman' });
      const varietas = page.getByRole('combobox', { name: 'Varietas' });
      const lokasi = page.getByRole('combobox', { name: 'Lokasi' });
      const status = page.getByRole('combobox', { name: 'Status siklus' });

      await expect(lahan).toBeVisible();
      await expect(tanaman).toBeVisible();
      await expect(varietas).toBeVisible();
      await expect(lokasi).toBeVisible();
      await expect(status).toBeVisible();
      await assertNoPageOverflow(page);

      await tanaman.click();
      const cropBox = await tanaman.boundingBox();
      const cropList = page.getByRole('listbox', { name: 'Saran Tanaman' });
      await expect(cropList).toBeVisible();
      const listBox = await cropList.boundingBox();
      expect(cropBox && listBox).toBeTruthy();
      if (cropBox && listBox) {
        expect(listBox.y).toBeGreaterThan(cropBox.y);
        expect(listBox.x).toBeGreaterThanOrEqual(cropBox.x - 8);
      }
      await page.getByRole('option', { name: 'Padi' }).click();
      await expect(page.getByRole('button', { name: 'Atur ulang filter' })).toBeVisible();
      await expect(page.locator('tbody tr').first().locator('.col-no')).toHaveText('1');
      await assertNoPageOverflow(page);

      await page.getByRole('button', { name: 'Atur ulang filter' }).click();
      await expect(page.getByRole('button', { name: 'Atur ulang filter' })).toHaveCount(0);
    });
  }
});
