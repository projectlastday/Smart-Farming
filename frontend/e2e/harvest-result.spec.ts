import { test, expect, type Page } from '@playwright/test';
import { loginAsDemo } from './session';

async function login(page: Page) {
  await loginAsDemo(page);
}

test.describe('Harvest prediction page', () => {
  test('rice-only cycle list and polished result card', async ({ page }) => {
    await login(page);
    await page.goto('/features/harvest');

    const cycle = page.getByRole('combobox', { name: 'Siklus Tanam' });
    await cycle.click();
    await expect(page.getByRole('option', { name: /guava|jambu/i })).toHaveCount(0);
    const riceOption = page.getByRole('option', { name: /Padi/i }).first();
    await expect(riceOption).toBeVisible();
    await riceOption.click();

    await page.getByRole('button', { name: 'Prediksi Panen' }).click();
    const result = page.locator('.harvest-result');
    await expect(result.getByRole('heading', { name: 'Prediksi Panen' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(result.getByText('Perkiraan jendela panen')).toBeVisible();
    await expect(result.getByText(/Keandalan aturan/)).toBeVisible();
    await expect(result.getByRole('meter')).toHaveCount(0);
    await expect(result.getByRole('heading', { name: 'Penjelasan' })).toBeVisible();
    await expect(result.getByRole('heading', { name: 'Rekomendasi' })).toBeVisible();
    await expect(result.getByRole('heading', { name: 'Asumsi' })).toBeVisible();
    await expect(result.getByRole('note')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tandai Panen' })).toBeVisible();
    await expect(page.getByLabel('Tanggal panen aktual')).toBeVisible();
  });
});
