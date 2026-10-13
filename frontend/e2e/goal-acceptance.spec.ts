import { test, expect, type Page } from '@playwright/test';
import {
  APP_ORIGIN,
  DEMO_EMAIL,
  DEMO_PASSWORD,
  E2E_EMAIL,
  E2E_PASSWORD,
  KNOWN_GOOD_BLAST,
  PUBLIC_ORIGIN,
  SUPERADMIN_EMAIL,
  SUPERADMIN_PASSWORD,
  apiLogin,
  loginAsDemo,
  loginAsE2E,
  loginAsSuperadmin,
  mutatingHeaders,
} from './session';

type Cycle = {
  id: string;
  farm_id: string;
  crop: string;
  variety: string;
  planting_date: string;
  location: string;
  actual_harvest_date?: string | null;
};

type Farm = { id: string; name: string; location: string };

async function clickLogout(page: Page) {
  const menu = page.getByRole('button', { name: 'Menu' });
  if (await menu.isVisible()) {
    await menu.click();
  }
  await page.getByRole('button', { name: 'Keluar' }).click();
}

async function selectRiceCycle(page: Page) {
  const combo = page.getByRole('combobox', { name: 'Siklus Tanam' });
  await expect(combo).toBeVisible();
  await combo.click();
  const option = page.getByRole('listbox').getByRole('option').filter({ hasText: /Padi/i }).first();
  await expect(option).toBeVisible();
  await option.click();
}

test.describe('Goal acceptance against live Compose', () => {
  test('demo farms are realistic rice and guava without E2E residue', async ({ page, request }) => {
    const { csrf } = await apiLogin(request, DEMO_EMAIL, DEMO_PASSWORD);
    const farms = (await (await request.get('/api/v1/farms')).json()) as Farm[];
    const names = farms.map((farm) => farm.name);
    expect(names).toContain('Sawah Ngemplak');
    expect(names.some((name) => /Kebun Jambu/i.test(name))).toBeTruthy();
    expect(names.join(' ')).not.toMatch(/\bE2E\b/i);
    const cycles = (await (await request.get('/api/v1/crop-cycles')).json()) as Cycle[];
    const today = new Date().toISOString().slice(0, 10);
    for (const cycle of cycles) {
      expect(cycle.location, cycle.location).not.toMatch(/E2E|Blocked|Curl|\btest\b/i);
      if (cycle.crop === 'rice') {
        expect(cycle.planting_date <= today).toBeTruthy();
      }
    }
    expect(csrf).toBeTruthy();

    await loginAsDemo(page);
    await page.goto('/farms');
    await expect(page.locator('td[data-label="Nama"]').filter({ hasText: 'Sawah Ngemplak' })).toBeVisible();
    await expect(page.getByText(/\bE2E-/)).toHaveCount(0);
  });

  test('online disease classifies known-good blast', async ({ page }) => {
    await loginAsDemo(page);
    await page.goto('/features/disease');
    await selectRiceCycle(page);
    await page.locator('#leaf-image').setInputFiles(KNOWN_GOOD_BLAST);
    await page.getByRole('button', { name: 'Diagnosis Online' }).click();
    await expect(page.locator('.result-block')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/blast/i).first()).toBeVisible();
    await expect(page.getByText(/Tidak Berlaku/)).toHaveCount(0);
  });

  test('overdue harvest stage and actual harvest delta', async ({ page, request }) => {
    const { csrf, origin } = await apiLogin(request, E2E_EMAIL, E2E_PASSWORD);
    const headers = mutatingHeaders(csrf, origin);
    const farms = (await (await request.get('/api/v1/farms')).json()) as Farm[];
    const riceFarm = farms.find((farm) => /sawah|padi|rice/i.test(farm.name)) ?? farms[0];
    expect(riceFarm).toBeTruthy();
    const planting = new Date();
    planting.setUTCDate(planting.getUTCDate() - 200);
    const plantingDate = planting.toISOString().slice(0, 10);
    const created = await request.post(`/api/v1/farms/${riceFarm.id}/crop-cycles`, {
      headers,
      data: {
        crop: 'rice',
        variety: 'Ciherang',
        planting_date: plantingDate,
        area: 0.11,
        location: 'Blok Overdue',
        lifecycle_status: 'growing',
      },
    });
    expect(created.ok(), `create cycle HTTP ${created.status()}`).toBeTruthy();
    const cycle = (await created.json()) as Cycle;

    const harvest = await request.post('/api/v1/features/harvest', {
      headers,
      data: { crop_cycle_id: cycle.id, variety_key: 'ciherang' },
    });
    expect(harvest.ok()).toBeTruthy();
    const harvestBody = await harvest.json();
    expect(harvestBody.output.growth_stage).toBe('overdue');

    await loginAsE2E(page);
    await page.goto(`/features/harvest?cycle=${cycle.id}`);
    await expect(page.getByRole('button', { name: 'Prediksi Panen' })).toBeEnabled({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Prediksi Panen' }).click();
    await expect(page.getByText('Jendela Panen Terlewat').first()).toBeVisible({ timeout: 15_000 });

    const actual = new Date().toISOString().slice(0, 10);
    await page.getByLabel('Tanggal panen aktual').fill(actual);
    await page.getByRole('button', { name: 'Tandai Panen' }).click();
    await expect(page.getByText('Panen aktual tersimpan. Prediksi lama tidak diubah.')).toBeVisible();

    const markedCycleResp = await page.request.get('/api/v1/crop-cycles');
    expect(markedCycleResp.ok()).toBeTruthy();
    const markedCycles = (await markedCycleResp.json()) as Cycle[];
    const markedCycle = markedCycles.find((item) => item.id === cycle.id);
    expect(markedCycle?.actual_harvest_date).toBe(actual);
    expect(markedCycle?.lifecycle_status).toBe('harvested');

    const csrfToken = await page.evaluate(() => sessionStorage.getItem('agrifusion_csrf'));
    expect(csrfToken).toBeTruthy();
    const again = await page.request.post('/api/v1/features/harvest', {
      headers: mutatingHeaders(csrfToken ?? '', APP_ORIGIN),
      data: { crop_cycle_id: cycle.id, variety_key: 'ciherang' },
    });
    expect(again.ok(), `harvest-after-actual HTTP ${again.status()}`).toBeTruthy();
    const againBody = await again.json();
    expect(againBody.output.growth_stage).toBe('harvested');
    expect(againBody.output.predicted_vs_actual.actual_harvest_date).toBe(actual);
    expect(againBody.output.predicted_vs_actual.delta_days_from_window_mid).not.toBeNull();
  });

  test('prediction history beyond 100 remains filterable for an old cycle', async ({ request }) => {
    test.setTimeout(120_000);
    const { csrf, origin } = await apiLogin(request, E2E_EMAIL, E2E_PASSWORD);
    const headers = mutatingHeaders(csrf, origin);
    const farms = (await (await request.get('/api/v1/farms')).json()) as Farm[];
    const riceFarm = farms.find((farm) => /sawah|padi|rice/i.test(farm.name)) ?? farms[0];
    const oldCycleResp = await request.post(`/api/v1/farms/${riceFarm.id}/crop-cycles`, {
      headers,
      data: {
        crop: 'rice',
        variety: 'IR64',
        planting_date: '2025-01-15',
        area: 0.12,
        location: 'Blok Histori Lama',
        lifecycle_status: 'growing',
      },
    });
    expect(oldCycleResp.ok()).toBeTruthy();
    const oldCycle = (await oldCycleResp.json()) as Cycle;
    const marker = await request.post('/api/v1/features/soil', {
      headers,
      data: {
        crop_cycle_id: oldCycle.id,
        ph: 5.7,
        moisture: 40,
        nitrogen: 0.12,
        phosphorus: 0.05,
        potassium: 0.08,
        input_provenance: 'manual',
      },
    });
    expect(marker.ok()).toBeTruthy();
    const markerId = (await marker.json()).id as string;

    const floodCycleResp = await request.post(`/api/v1/farms/${riceFarm.id}/crop-cycles`, {
      headers,
      data: {
        crop: 'rice',
        variety: 'Ciherang',
        planting_date: '2026-06-01',
        area: 0.13,
        location: 'Blok Histori Baru',
        lifecycle_status: 'growing',
      },
    });
    expect(floodCycleResp.ok()).toBeTruthy();
    const floodCycle = (await floodCycleResp.json()) as Cycle;
    for (let i = 0; i < 110; i += 1) {
      const synced = await request.post('/api/v1/predictions/sync', {
        headers,
        data: {
          client_operation_id: `e2e-hist-${floodCycle.id}-${i}`,
          farm_id: riceFarm.id,
          crop_cycle_id: floodCycle.id,
          feature_type: 'harvest',
          model_version: 'harvest-duration-v1',
          inputs_snapshot: { i },
          output: { i, status: 'ok' },
          confidence: null,
          assumptions: 'e2e',
          explanation: 'pagination flood',
          recommendation: 'abaikan',
        },
      });
      expect(synced.ok(), `sync ${i} HTTP ${synced.status()}`).toBeTruthy();
    }

    const listed = await request.get('/api/v1/predictions?page=1&page_size=20');
    const listedBody = await listed.json();
    expect(listedBody.total).toBeGreaterThan(100);
    expect(listedBody.items).toHaveLength(20);

    const filtered = await request.get(`/api/v1/predictions?crop_cycle_id=${oldCycle.id}&page_size=20`);
    const filteredItems = (await filtered.json()).items as { id: string; crop_cycle_id: string }[];
    expect(filteredItems.some((item) => item.id === markerId)).toBeTruthy();
    expect(filteredItems.every((item) => item.crop_cycle_id === oldCycle.id)).toBeTruthy();

    const latest = await request.get(
      `/api/v1/predictions?crop_cycle_id=${oldCycle.id}&latest_per_feature=true&page_size=50`,
    );
    const latestItems = (await latest.json()).items as { feature_type: string }[];
    expect(latestItems.some((item) => item.feature_type === 'soil')).toBeTruthy();
  });

  test('farmer cannot read another farmer farm, cycle, or prediction', async ({ playwright, request }) => {
    const demo = await apiLogin(request, DEMO_EMAIL, DEMO_PASSWORD);
    const demoFarms = (await (await request.get('/api/v1/farms')).json()) as Farm[];
    const demoCycles = (await (await request.get('/api/v1/crop-cycles')).json()) as Cycle[];
    const demoPreds = await request.get('/api/v1/predictions?page=1&page_size=5');
    const demoItems = ((await demoPreds.json()).items ?? []) as { id: string }[];
    expect(demoFarms[0]).toBeTruthy();
    expect(demoCycles[0]).toBeTruthy();
    expect(demoItems[0]).toBeTruthy();
    expect(demo.csrf).toBeTruthy();

    const isolated = await playwright.request.newContext({ baseURL: APP_ORIGIN });
    const e2e = await apiLogin(isolated, E2E_EMAIL, E2E_PASSWORD);
    const farmResp = await isolated.get(`/api/v1/farms`);
    const e2eFarms = (await farmResp.json()) as Farm[];
    expect(e2eFarms.every((farm) => farm.id !== demoFarms[0].id)).toBeTruthy();

    const harvestSteal = await isolated.post('/api/v1/features/harvest', {
      headers: mutatingHeaders(e2e.csrf, e2e.origin),
      data: { crop_cycle_id: demoCycles[0].id, variety_key: 'ciherang' },
    });
    expect(harvestSteal.status()).toBe(404);

    const predSteal = await isolated.get(`/api/v1/predictions/${demoItems[0].id}`);
    expect(predSteal.status()).toBe(404);
    await isolated.dispose();
  });

  test('admin can create farmer and cannot create admin; superadmin can create admin directly', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const stamp = Date.now();
    const adminEmail = `e2e.admin.${stamp}@agrifusion.test`;
    const farmerEmail = `e2e.created.${stamp}@agrifusion.test`;
    const adminPassword = 'E2eAdminSetup123!';

    await loginAsSuperadmin(page);
    await page.goto('/admin/farmers');
    await expect(page.getByRole('heading', { name: /Kelola Akun Petani/i })).toBeVisible();
    await page.getByLabel('Nama').fill('E2E Admin Setup');
    await page.getByLabel('Email').fill(adminEmail);
    await page.getByLabel('Peran').selectOption('admin');
    await page.getByLabel('Kata Sandi', { exact: true }).fill(adminPassword);
    await page.getByLabel('Konfirmasi Kata Sandi').fill(adminPassword);
    await page.getByRole('button', { name: 'Buat Akun' }).click();
    await expect(page.getByText(/berhasil dibuat dan siap digunakan/)).toBeVisible();

    await page.goto('/admin/audit');
    await expect(page.getByRole('heading', { name: 'Log Audit' })).toBeVisible();
    await expect(page.getByText('Akun admin dibuat').first()).toBeVisible();

    await clickLogout(page);
    await page.getByLabel('Email').fill(adminEmail);
    await page.getByLabel('Kata Sandi').fill(adminPassword);
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });

    await page.goto('/admin/farmers');
    await expect(page.getByLabel('Peran')).toBeVisible();
    await expect(page.locator('#admin-role option[value="admin"]')).toHaveCount(0);
    await page.getByLabel('Nama').fill('E2E Petani Baru');
    await page.getByLabel('Email').fill(farmerEmail);
    await page.getByLabel('Kata Sandi', { exact: true }).fill('E2eFarmer123!');
    await page.getByLabel('Konfirmasi Kata Sandi').fill('E2eFarmer123!');
    await page.getByRole('button', { name: 'Buat Akun' }).click();
    await expect(page.getByText(/berhasil dibuat dan siap digunakan/)).toBeVisible();

    const csrf = await page.evaluate(() => sessionStorage.getItem('agrifusion_csrf'));
    expect(csrf).toBeTruthy();
    const denied = await page.request.post('/api/v1/auth/admin/create', {
      headers: mutatingHeaders(csrf ?? '', APP_ORIGIN),
      data: { name: 'Should Fail', email: `e2e.blocked.${stamp}@agrifusion.test`, password: 'BlockedAdmin123!', role: 'admin' },
    });
    expect(denied.status()).toBe(403);

    await page.goto('/admin/audit');
    await expect(page).toHaveURL(/dashboard/);
  });

  test('query error shows retry, not empty state', async ({ page }) => {
    await loginAsDemo(page);
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
      }
    });
    await page.addInitScript(() => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
        const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
        if (url.includes('/api/v1/farms') && method === 'GET') {
          return new Response(JSON.stringify({ detail: 'Server sedang bermasalah. Coba lagi.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return originalFetch(input, init);
      };
    });
    await page.goto('/farms');
    await expect(page.getByRole('alert')).toContainText('Gagal memuat lahan');
    await expect(page.getByRole('button', { name: 'Coba lagi' })).toBeVisible();
    await expect(page.getByText('Belum ada lahan. Tambahkan lahan pertama Anda.')).toHaveCount(0);
  });

  test('public HTTPS origin sends HSTS and security headers; local HTTP does not', async ({
    request,
  }) => {
    const local = await request.get(`${APP_ORIGIN}/api/v1/health/ready`);
    expect(local.ok()).toBeTruthy();
    const localHeaders = local.headers();
    expect(localHeaders['x-content-type-options'] ?? '').toMatch(/nosniff/);
    expect(localHeaders['content-security-policy'] ?? '').toMatch(/wasm-unsafe-eval/);
    expect(localHeaders['strict-transport-security']).toBeFalsy();

    const publicReady = await request.get(`${PUBLIC_ORIGIN}/api/v1/health/ready`);
    expect(publicReady.ok(), `public ready HTTP ${publicReady.status()}`).toBeTruthy();
    const publicHeaders = publicReady.headers();
    expect(publicHeaders['strict-transport-security'] ?? '').toMatch(/max-age=31536000/);
    expect(publicHeaders['x-content-type-options'] ?? '').toMatch(/nosniff/);
    expect(publicHeaders['content-security-policy'] ?? '').toMatch(/frame-ancestors 'none'/);

    const publicHtml = await request.get(`${PUBLIC_ORIGIN}/`);
    expect(publicHtml.ok()).toBeTruthy();
    expect(publicHtml.headers()['strict-transport-security'] ?? '').toMatch(/max-age=31536000/);
    const html = await publicHtml.text();
    expect(html.toLowerCase()).not.toMatch(/mysql_password|superadmin_password|cloudflare_tunnel_token/);
  });
});
