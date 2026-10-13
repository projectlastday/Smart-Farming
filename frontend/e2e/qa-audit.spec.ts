import { test, expect, type Page } from '@playwright/test';
import { KNOWN_GOOD_BLAST, loginAsDemo } from './session';

type AuditState = {
  consoleErrors: string[];
  failedRequests: string[];
  badResponses: string[];
};

function attachAudit(page: Page, audit: AuditState) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      audit.consoleErrors.push(msg.text());
    }
  });
  page.on('requestfailed', (req) => {
    audit.failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText ?? 'unknown'}`);
  });
  page.on('response', async (resp) => {
    if (resp.url().includes('/api/') && resp.status() >= 400) {
      const body = await resp.text().catch(() => '');
      audit.badResponses.push(`${resp.status()} ${resp.request().method()} ${resp.url()} :: ${body.slice(0, 200)}`);
    }
  });
}

function assertCleanAudit(audit: AuditState) {
  const failedRequests = audit.failedRequests.filter(
    (e) => !e.includes('ERR_ABORTED') && !e.includes('net::ERR_ABORTED'),
  );
  expect(audit.consoleErrors, `console errors: ${audit.consoleErrors.join('; ')}`).toEqual([]);
  expect(failedRequests, `failed requests: ${failedRequests.join('; ')}`).toEqual([]);
  expect(audit.badResponses, `bad API responses: ${audit.badResponses.join('; ')}`).toEqual([]);
}

async function login(page: Page) {
  await loginAsDemo(page);
}

test.describe('Live QA audit', () => {
  test('desktop happy path has no console or API errors', async ({ page }) => {
    await login(page);
    const audit: AuditState = { consoleErrors: [], failedRequests: [], badResponses: [] };
    attachAudit(page, audit);

    for (const route of [
      '/dashboard',
      '/analysis',
      '/farms',
      '/crop-cycles',
      '/predictions',
      '/features/harvest',
      '/features/soil',
      '/features/disease',
      '/features/rejuvenation',
      '/features/offline',
    ]) {
      await page.goto(route);
      await page.waitForLoadState('load');
    }

    assertCleanAudit(audit);
  });

  test('mobile nav layout exposes primary routes', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await login(page);
    const audit: AuditState = { consoleErrors: [], failedRequests: [], badResponses: [] };
    attachAudit(page, audit);
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.locator('.navbar-links').getByRole('link', { name: 'Dasbor' })).toBeVisible();
    await expect(page.locator('.navbar-links').getByRole('link', { name: 'Lahan', exact: true })).toBeVisible();
    await page.goto('/features/harvest');
    await expect(page.getByRole('heading', { name: /Prediksi Waktu Panen Padi/i })).toBeVisible({
      timeout: 15_000,
    });
    assertCleanAudit(audit);
  });

  test('disease page shows unsupported crop guidance', async ({ page }) => {
    await login(page);
    await page.goto('/features/disease');
    await expect(page.getByText(/Hanya berlaku untuk siklus tanam.*padi/i)).toBeVisible();
    await page.getByRole('combobox', { name: 'Siklus Tanam' }).click();
    await expect(page.getByRole('option', { name: /guava|jambu/i })).toHaveCount(0);
  });

  test('validation blocks empty farm submit', async ({ page }) => {
    await login(page);
    await page.goto('/farms');
    await page.getByRole('button', { name: '+ Tambah Lahan' }).click();
    await page.getByRole('button', { name: 'Simpan' }).click();
    await expect(page.locator('#farm-name:invalid')).toBeVisible();
  });

  test('seeded demo data visible on dashboard', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('heading', { name: /Selamat datang/i })).toBeVisible();
    await expect(page.getByText('Lahan Aktif')).toBeVisible();
    await page.goto('/predictions');
    await page.getByRole('combobox', { name: 'Status hasil' }).click();
    await page.getByRole('option', { name: 'Tidak Berlaku' }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Tidak Berlaku' }).first()).toBeVisible();
  });

  test('offline model install succeeds on 127.0.0.1', async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    const audit: AuditState = { consoleErrors: [], failedRequests: [], badResponses: [] };
    attachAudit(page, audit);
    await page.goto('/features/offline');
    await page.getByRole('button', { name: /Aktifkan AI Offline|Perbarui Model/i }).click();
    await expect(page.getByText(/Model v.*terinstal/i)).toBeVisible({ timeout: 60_000 });

    await page.getByRole('combobox', { name: 'Siklus Tanam' }).click();
    await page.getByRole('listbox', { name: 'Saran Siklus Tanam' }).getByRole('option').nth(1).click();
    await page.locator('#offline-image').setInputFiles(KNOWN_GOOD_BLAST);
    await page.getByRole('button', { name: 'Diagnosis Offline' }).click();
    await expect(page.getByText(/Hasil:/i)).toBeVisible({ timeout: 30_000 });

    assertCleanAudit(audit);
  });
});
