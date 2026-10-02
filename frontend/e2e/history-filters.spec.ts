import { test, expect, type Page } from '@playwright/test';
import { loginAsDemo } from './session';

async function login(page: Page) {
  await loginAsDemo(page);
}

async function openHistory(page: Page) {
  await page.goto('/predictions');
  await expect(page).toHaveURL(/\/predictions/);
  await expect(page.getByRole('heading', { name: 'Riwayat Prediksi' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByLabel('Dari tanggal')).toBeVisible();
}

function top(box: { y: number } | null) {
  expect(box).toBeTruthy();
  return box!.y;
}

test.describe('Riwayat filter layout', () => {
  test('desktop keeps five history filters on one row', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page);
    await openHistory(page);

    const toolbar = page.getByRole('region', { name: 'Filter dan paginasi' });
    const labels = [
      toolbar.getByText('Cari riwayat', { exact: true }),
      toolbar.getByText('Fitur', { exact: true }),
      toolbar.getByText('Status hasil', { exact: true }),
      toolbar.getByText('Dari tanggal', { exact: true }),
      toolbar.getByText('Sampai tanggal', { exact: true }),
    ];
    const tops = [];
    for (const label of labels) {
      tops.push(top(await label.boundingBox()));
    }
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(12);
  });

  test('tablet keeps date filters adjacent', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await login(page);
    await openHistory(page);

    const from = top(await page.getByText('Dari tanggal', { exact: true }).boundingBox());
    const to = top(await page.getByText('Sampai tanggal', { exact: true }).boundingBox());
    expect(Math.abs(from - to)).toBeLessThan(12);
  });

  test('narrow mobile stacks date filters', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page);
    await openHistory(page);

    const from = await page.getByLabel('Dari tanggal').boundingBox();
    const to = await page.getByLabel('Sampai tanggal').boundingBox();
    expect(from).toBeTruthy();
    expect(to).toBeTruthy();
    expect(to!.y).toBeGreaterThan(from!.y + 24);
  });
});
