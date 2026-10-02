import { test, expect, type Page } from '@playwright/test';
import { loginAsDemo } from './session';

async function login(page: Page) {
  await loginAsDemo(page);
}

test.describe('Feature form searchable selectors', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('harvest cycle and variety are searchable comboboxes', async ({ page }) => {
    await page.goto('/features/harvest');
    const cycle = page.getByRole('combobox', { name: 'Siklus Tanam' });
    await cycle.click();
    await expect(page.getByRole('listbox', { name: 'Saran Siklus Tanam' })).toBeVisible();
    await expect(page.getByRole('option', { name: /guava|jambu/i })).toHaveCount(0);
    await cycle.fill('ciherang');
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.getByRole('option').first().click();

    const variety = page.getByRole('combobox', { name: 'Varietas Padi' });
    await variety.click();
    await variety.fill('ir');
    await expect(page.getByRole('option', { name: 'IR64' })).toBeVisible();
    await page.getByRole('option', { name: 'IR64' }).click();
    await expect(variety).toHaveValue('IR64');
    await expect(page.getByRole('button', { name: 'Prediksi Panen' })).toBeEnabled();
  });

  test('disease cycle search stays rice-only', async ({ page }) => {
    await page.goto('/features/disease');
    await page.getByRole('combobox', { name: 'Siklus Tanam' }).click();
    await expect(page.getByRole('option', { name: /guava|jambu/i })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Varietas Padi' })).toHaveCount(0);
  });

  test('rejuvenation cycle search stays guava-only', async ({ page }) => {
    await page.goto('/features/rejuvenation');
    await page.getByRole('combobox', { name: 'Siklus Tanam' }).click();
    await expect(page.getByRole('option', { name: /rice|padi|Ciherang/i })).toHaveCount(0);
    await expect(page.getByRole('option', { name: /guava|jambu|Kristal/i }).first()).toBeVisible();
  });

  test('soil mapping and offline expose searchable cycles', async ({ page }) => {
    for (const path of ['/features/soil', '/features/mapping', '/features/offline']) {
      await page.goto(path);
      await expect(page.getByRole('combobox', { name: 'Siklus Tanam' })).toBeVisible();
    }
  });
});
