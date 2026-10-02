import { test, expect, type Page } from '@playwright/test';
import { loginAsDemo } from './session';

async function login(page: Page) {
  await loginAsDemo(page);
}

test.describe('List autocomplete filters', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Lahan lokasi filter opens a searchable dropdown', async ({ page }) => {
    await page.goto('/farms');
    const lokasi = page.getByRole('combobox', { name: 'Filter lokasi' });
    await lokasi.click();
    await expect(page.getByRole('listbox', { name: 'Saran Filter lokasi' })).toBeVisible();
    await lokasi.fill('a');
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox', { name: 'Saran Filter lokasi' })).toHaveCount(0);
    await expect(page.getByLabel('Baris per halaman')).toBeVisible();
  });

  test('Siklus Tanam lahan filter is searchable', async ({ page }) => {
    await page.goto('/crop-cycles');
    const lahan = page.getByRole('combobox', { name: 'Lahan' });
    await lahan.click();
    await expect(page.getByRole('listbox', { name: 'Saran Lahan' })).toBeVisible();
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('combobox', { name: 'Tanaman' }).click();
    await expect(page.getByRole('listbox', { name: 'Saran Tanaman' })).toBeVisible();
  });

  test('Riwayat feature filter dropdown stays below the field and dates remain date inputs', async ({ page }) => {
    await page.goto('/predictions');
    const fitur = page.getByRole('combobox', { name: 'Fitur' });
    await fitur.click();
    const listbox = page.getByRole('listbox', { name: 'Saran Fitur' });
    await expect(listbox).toBeVisible();
    const fieldBox = await fitur.boundingBox();
    const listBox = await listbox.boundingBox();
    expect(fieldBox && listBox).toBeTruthy();
    if (fieldBox && listBox) {
      expect(listBox.y).toBeGreaterThan(fieldBox.y);
    }
    await expect(page.getByLabel('Dari tanggal')).toHaveAttribute('type', 'date');
    await expect(page.getByLabel('Sampai tanggal')).toHaveAttribute('type', 'date');
  });
});
