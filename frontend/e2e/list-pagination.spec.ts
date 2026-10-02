import { test, expect, type Page } from '@playwright/test';
import { loginAsDemo } from './session';

async function login(page: Page) {
  await loginAsDemo(page);
}

async function expectNoColumnAvailable(page: Page) {
  const header = page.getByRole('columnheader', { name: 'No' });
  const isMobile = await page.evaluate(() => window.innerWidth <= 720);
  if (isMobile) {
    // Mobile tables use accessible card rows; the header remains in the DOM but is visually hidden.
    await expect(header).toBeAttached();
  } else {
    await expect(header).toBeVisible();
  }
}

test.describe('List pagination and filters', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Lahan page shows No column, filters, and pagination', async ({ page }) => {
    await page.goto('/farms');
    await expectNoColumnAvailable(page);
    await expect(page.getByLabel('Cari lahan')).toBeVisible();
    await expect(page.getByLabel('Baris per halaman')).toBeVisible();

    const firstNo = page.locator('tbody tr').first().locator('.col-no');
    await expect(firstNo).toHaveText('1');

    await page.getByLabel('Baris per halaman').selectOption('10');
    await expect(page.getByText(/Halaman \d+ dari \d+/)).toBeVisible();
    const pageSize = page.getByLabel('Baris per halaman');
    await expect(pageSize.locator('option', { hasText: 'Semua' })).toHaveCount(1);
    await expect(pageSize.locator('option', { hasText: '100' })).toHaveCount(1);
    await expect(pageSize.locator('option', { hasText: '200' })).toHaveCount(1);
  });

  test('Siklus Tanam page supports crop filter and page navigation', async ({ page }) => {
    await page.goto('/crop-cycles');
    await expectNoColumnAvailable(page);
    await page.getByLabel('Tanaman').fill('Padi');
    await page.getByRole('option', { name: 'Padi' }).click();
    await expect(page.locator('tbody tr').first().locator('.col-no')).toHaveText('1');
    await expect(page.getByRole('button', { name: 'Halaman berikutnya' })).toBeVisible();
  });

  test('Riwayat page supports feature filter and detail links', async ({ page }) => {
    await page.goto('/predictions');
    await expectNoColumnAvailable(page);
    await expect(page.getByLabel('Fitur')).toBeVisible();
    await page.getByLabel('Fitur').click();
    await expect(page.getByRole('listbox', { name: 'Saran Fitur' })).toBeVisible();
    await page.getByRole('option', { name: 'Prediksi Panen' }).click();
    await expect(page.getByRole('link', { name: 'Buka detail' }).first()).toBeVisible();
    await expect(page.locator('tbody tr').first().locator('.col-no')).toHaveText('1');
  });
});
