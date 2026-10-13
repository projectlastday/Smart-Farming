import { test, expect, type Page } from '@playwright/test';
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  KNOWN_GOOD_BLAST,
  SUPERADMIN_EMAIL,
  SUPERADMIN_PASSWORD,
  e2eFarmName,
  loginAs,
  loginAsE2E,
} from './session';

const FEATURE_ROUTES = [
  { path: '/features/harvest', heading: /Prediksi Waktu Panen Padi/i },
  { path: '/features/soil', heading: /Analisis Kondisi Tanah/i },
  { path: '/features/disease', heading: /Diagnosis Penyakit Daun Padi/i },
  { path: '/features/rejuvenation', heading: /Rejuvenasi Kebun Jambu/i },
  { path: '/features/offline', heading: /AI Offline/i },
] as const;

async function login(page: Page, email = DEMO_EMAIL, password = DEMO_PASSWORD) {
  await loginAs(page, email, password);
  await expect(page.getByRole('heading', { name: /Selamat datang/i })).toBeVisible();
}

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

async function selectGuavaCycle(page: Page) {
  const combo = page.getByRole('combobox', { name: 'Siklus Tanam' });
  await expect(combo).toBeVisible();
  await combo.click();
  const option = page.getByRole('listbox').getByRole('option').filter({ hasText: /guava|jambu/i }).first();
  await expect(option).toBeVisible();
  await option.click();
}

async function expectPredictionResult(page: Page) {
  await expect(page.locator('.result-block')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.result-block h3')).toHaveText(/Hasil:|Prediksi Panen/);
}

test.describe('Authentication', () => {
  test('login and dashboard', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText(/Punya token setup/i)).toHaveCount(0);
    await page.goto('/setup-password');
    await expect(page.getByRole('heading', { name: /Halaman tidak ditemukan/i })).toBeVisible();
    await login(page);
    await expect(page.getByRole('heading', { name: /Selamat datang/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Pilih siklus tanam untuk mulai/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Buka analisis/ }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Lihat semua lahan' })).toBeVisible();
  });

  test('logout clears session', async ({ page }) => {
    await login(page);
    const logoutResp = page.waitForResponse(
      (r) => r.url().includes('/auth/logout') && r.request().method() === 'POST',
    );
    await clickLogout(page);
    expect((await logoutResp).ok()).toBeTruthy();
    await expect(page).toHaveURL(/login/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });

  test('registration when enabled', async ({ page }) => {
    const unique = `e2e.${Date.now()}@example.com`;
    await page.goto('/register');
    await page.getByLabel('Nama Lengkap').fill('E2E Petani');
    await page.getByLabel('Email').fill(unique);
    await page.getByLabel(/Kata Sandi/i).fill('E2eRegister123!');
    const registerResp = page.waitForResponse(
      (r) => r.url().includes('/auth/register') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Daftar' }).click();
    expect((await registerResp).ok()).toBeTruthy();
    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
  });
});

test.describe('Navigation and feature routes', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const route of FEATURE_ROUTES) {
    test(`loads ${route.path}`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible({
        timeout: 15_000,
      });
    });
  }

  test('retired farmland-mapping route is unavailable', async ({ page }) => {
    await page.goto('/features/mapping');
    await expect(page.getByRole('heading', { name: /Halaman tidak ditemukan/i })).toBeVisible();
  });
});

test.describe('Feature flows', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('harvest prediction for rice cycle', async ({ page }) => {
    await page.goto('/features/harvest');
    await selectRiceCycle(page);
    await page.getByRole('button', { name: 'Prediksi Panen' }).click();
    await expectPredictionResult(page);
  });

  test('soil analysis', async ({ page }) => {
    await page.goto('/features/soil');
    await selectRiceCycle(page);
    await page.getByRole('button', { name: 'Analisis Tanah' }).click();
    await expectPredictionResult(page);
  });

  test('rejuvenation for guava cycle', async ({ page }) => {
    await page.goto('/features/rejuvenation');
    await selectGuavaCycle(page);
    await page.getByRole('button', { name: 'Evaluasi Rejuvenasi' }).click();
    await expectPredictionResult(page);
  });

  test('online disease diagnosis', async ({ page }) => {
    await page.goto('/features/disease');
    await selectRiceCycle(page);
    await page.locator('#leaf-image').setInputFiles(KNOWN_GOOD_BLAST);
    await page.getByRole('button', { name: 'Diagnosis Online' }).click();
    await expectPredictionResult(page);
    await expect(page.getByText(/blast/i).first()).toBeVisible();
  });

  test('unsupported crop returns Tidak Berlaku via API', async ({ request }) => {
    const loginResp = await request.post('/api/v1/auth/login', {
      data: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    });
    expect(loginResp.ok()).toBeTruthy();
    const { csrf_token: csrf } = await loginResp.json();
    const cookies = (await loginResp.headersArray())
      .filter((h) => h.name.toLowerCase() === 'set-cookie')
      .map((h) => h.value.split(';')[0])
      .join('; ');

    const cyclesResp = await request.get('/api/v1/crop-cycles', {
      headers: { Cookie: cookies },
    });
    const cycles = await cyclesResp.json();
    const guavaCycle = cycles.find((c: { crop: string }) => c.crop === 'guava');
    expect(guavaCycle).toBeTruthy();

    const harvestResp = await request.post('/api/v1/features/harvest', {
      headers: {
        Cookie: cookies,
        'X-CSRF-Token': csrf,
        Origin: 'http://127.0.0.1:8005',
        'Content-Type': 'application/json',
      },
      data: { crop_cycle_id: guavaCycle.id, variety_key: 'ciherang' },
    });
    expect(harvestResp.ok()).toBeTruthy();
    const body = await harvestResp.json();
    expect(body.output.status).toBe('not_applicable');
  });

  test('seeded Tidak Berlaku example in history', async ({ page }) => {
    await page.goto('/predictions');
    await page.getByRole('combobox', { name: 'Status hasil' }).click();
    await page.getByRole('option', { name: 'Tidak Berlaku' }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Tidak Berlaku' }).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe('Offline model and queue', () => {
  test('install ONNX model and run offline inference', async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    await page.goto('/features/offline');
    await expect(page.getByRole('heading', { name: /AI Offline/i })).toBeVisible();

    await page.getByRole('button', { name: /Aktifkan AI Offline|Perbarui Model/i }).click();
    await expect(page.getByText(/Model v.*terinstal/i)).toBeVisible({ timeout: 60_000 });

    await selectRiceCycle(page);
    await page.locator('#offline-image').setInputFiles(KNOWN_GOOD_BLAST);
    await page.getByRole('button', { name: 'Diagnosis Offline' }).click();
    await expect(page.getByText(/Hasil:/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/disimpan ke antrian lokal/i)).toBeVisible();

    const syncButton = page.getByRole('button', { name: 'Sinkronkan Sekarang' });
    await syncButton.scrollIntoViewIfNeeded();
    await syncButton.click();
    await expect(page.getByText(/Selesai:.*tersinkron/i)).toBeVisible({ timeout: 45_000 });
  });
});

test.describe('RBAC', () => {
  test('farmer blocked from admin farmers page', async ({ page }) => {
    await login(page);
    await page.goto('/admin/farmers');
    await expect(page).toHaveURL(/dashboard/);
  });

  test('farmer blocked from superadmin reference page', async ({ page }) => {
    await login(page);
    await page.goto('/admin/reference');
    await expect(page).toHaveURL(/dashboard/);
  });

  test('superadmin can open reference page', async ({ page }) => {
    await login(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    await page.goto('/admin/reference');
    await expect(page.getByRole('heading', { name: /Referensi Pertanian/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('superadmin can open admin farmers page', async ({ page }) => {
    await login(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
    await page.goto('/admin/farmers');
    await expect(page.getByRole('heading', { name: /Kelola Akun Petani/i })).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe('Farm and cycle management', () => {
  test('create farm', async ({ page }) => {
    await loginAsE2E(page);
    await page.goto('/farms');
    await page.getByRole('button', { name: '+ Tambah Lahan' }).click();
    const farmName = e2eFarmName('App Sawah');
    const location = `Semarang ${Date.now()}`;
    await page.getByLabel('Nama Lahan').fill(farmName);
    await page.locator('#farm-location').fill(location);
    const createResp = page.waitForResponse(
      (r) => r.url().includes('/api/v1/farms') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Simpan' }).click();
    expect((await createResp).ok()).toBeTruthy();
    await page.getByRole('combobox', { name: 'Cari lahan' }).fill(farmName);
    await expect(page.getByRole('row').filter({ hasText: farmName })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('create crop cycle', async ({ page }) => {
    await loginAsE2E(page);
    await page.goto('/crop-cycles');
    await expect(page.getByRole('heading', { name: /Siklus Tanam/i })).toBeVisible();
    await page.getByRole('button', { name: '+ Tambah Siklus' }).click();
    const uniqueArea = Number((((Date.now() % 9000) + 1000) / 10000).toFixed(2));
    const areaLabel = `${uniqueArea.toFixed(2)} ha`;
    const uniqueDate = `2030-06-${String((Date.now() % 28) + 1).padStart(2, '0')}`;
    await page.locator('#cycle-farm').click();
    await page.getByRole('option').nth(1).click();
    await page.locator('#cycle-date').fill(uniqueDate);
    await page.locator('#cycle-area').fill(String(uniqueArea));
    await page.locator('#cycle-location').fill('Blok E2E');
    const createResp = page.waitForResponse(
      (r) => r.url().includes('/crop-cycles') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Simpan Siklus' }).click();
    expect((await createResp).ok()).toBeTruthy();
    await page.getByLabel('Baris per halaman').selectOption({ label: 'Semua' });
    await expect(
      page.getByRole('row').filter({ hasText: uniqueDate }).filter({ hasText: areaLabel }),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('API health via proxy', () => {
  test('ready endpoint reports model available', async ({ request }) => {
    const resp = await request.get('/api/v1/health/ready');
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.status).toBe('ready');
    expect(body.model_available).toBe(true);
  });

  test('disease model metadata and download', async ({ request }) => {
    const unauth = await request.get('/api/v1/features/disease/model/metadata');
    expect(unauth.status()).toBe(401);

    const loginResp = await request.post('/api/v1/auth/login', {
      data: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    });
    expect(loginResp.ok()).toBeTruthy();

    const meta = await request.get('/api/v1/features/disease/model/metadata');
    expect(meta.ok()).toBeTruthy();
    const metaBody = await meta.json();
    expect(metaBody.mode).toBe('trained_mobilenet_v3_small');
    expect(metaBody.version).toBe('disease-mobilenet-v1-paddy-doctor');
    expect(metaBody.hash).toBeTruthy();

    const dl = await request.get('/api/v1/features/disease/model/download');
    expect(dl.ok()).toBeTruthy();
    const buf = await dl.body();
    expect(buf.byteLength).toBeGreaterThan(100_000);
  });
});
