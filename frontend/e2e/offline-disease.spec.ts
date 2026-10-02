import { test, expect } from '@playwright/test';
import { KNOWN_GOOD_BLAST, loginAsE2E } from './session';

test.describe('Offline disease install and sync', () => {
  test('install, go offline, reload, infer, then sync once', async ({ page, context }) => {
    test.setTimeout(180_000);
    await loginAsE2E(page);
    await page.goto('/features/offline');
    await expect(page.getByRole('heading', { name: /AI Offline/i })).toBeVisible();

    const installButton = page.getByRole('button', { name: /Aktifkan AI Offline|Perbarui Model/ });
    await installButton.click();
    await expect(page.getByText(/terinstal/i)).toBeVisible({ timeout: 120_000 });

    await page.getByRole('combobox', { name: 'Siklus Tanam' }).click();
    await page.getByRole('option', { name: /Padi/i }).first().click();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.ready;
      }
    });

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /AI Offline/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/terinstal/i)).toBeVisible();

    const cycleCombo = page.getByRole('combobox', { name: 'Siklus Tanam' });
    await expect(cycleCombo).toBeVisible({ timeout: 20_000 });
    await cycleCombo.click();
    await page.getByRole('option', { name: /Padi/i }).first().click();
    await page.locator('#offline-image').setInputFiles(KNOWN_GOOD_BLAST);
    await page.getByRole('button', { name: 'Diagnosis Offline' }).click();
    await expect(page.getByText(/blast/i)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/antrian lokal/i)).toBeVisible();

    await context.setOffline(false);
    await expect.poll(async () => page.evaluate(() => navigator.onLine)).toBe(true);
    await page.getByRole('button', { name: 'Sinkronkan Sekarang' }).click();
    await expect(page.getByText(/Selesai: 1 tersinkron/)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Sinkronkan Sekarang' }).click();
    await expect(page.getByText(/Selesai: 0 tersinkron/)).toBeVisible({ timeout: 15_000 });
  });
});
