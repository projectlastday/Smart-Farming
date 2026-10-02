import { test, expect, type Page } from '@playwright/test';
import { e2eFarmName, loginAsE2E } from './session';

async function selectFarmOption(page: Page, farmName: string) {
  const combo = page.locator('#cycle-farm');
  await expect(combo).toBeVisible();
  await combo.click();
  await combo.fill(farmName);
  await expect(combo).toHaveValue(farmName);
  await page.keyboard.press('Escape');
}

async function showFarmInList(page: Page, farmName: string) {
  const search = page.getByRole('combobox', { name: 'Cari lahan' });
  await search.fill(farmName);
  await page.keyboard.press('Escape');
  await expect(farmNameCell(page, farmName)).toBeVisible();
}

function farmNameCell(page: Page, farmName: string) {
  return page.locator('td[data-label="Nama"]').filter({ hasText: farmName });
}

async function selectFirstFarm(page: Page) {
  const combo = page.locator('#cycle-farm');
  await expect(combo).toBeVisible();
  await combo.click();
  await page.getByRole('option').nth(1).click();
}

async function selectCycleByDate(page: Page, plantingDate: string) {
  const combo = page.getByRole('combobox', { name: 'Siklus Tanam' });
  await expect(combo).toBeVisible();
  await combo.click();
  const option = page.getByRole('listbox').getByRole('option').filter({ hasText: plantingDate }).first();
  await expect(option).toBeVisible();
  await option.click();
}

async function showAllListRows(page: Page) {
  const pageSize = page.getByLabel('Baris per halaman');
  await expect(pageSize).toBeVisible();
  await pageSize.selectOption({ label: 'Semua' });
}

test.describe('Farm CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsE2E(page);
  });

  test('create, edit, verify persistence, delete empty farm, cancel delete', async ({ page }) => {
    await page.goto('/farms');
    const suffix = Date.now();
    const farmName = e2eFarmName('CRUD Sawah');
    const editedName = `${farmName} Diubah`;

    await page.getByRole('button', { name: '+ Tambah Lahan' }).click();
    await page.getByLabel('Nama Lahan').fill(farmName);
    await page.locator('#farm-location').fill(`Lokasi ${suffix}`);
    await page.getByRole('button', { name: 'Simpan' }).click();
    await expect(page.getByRole('status')).toContainText('Lahan baru berhasil disimpan.');
    await showFarmInList(page, farmName);

    await page.getByRole('button', { name: `Ubah lahan ${farmName}` }).click();
    await page.getByLabel('Nama Lahan').fill(editedName);
    await page.getByRole('button', { name: 'Simpan Perubahan' }).click();
    await expect(page.getByRole('status')).toContainText('Perubahan lahan berhasil disimpan.');
    await showFarmInList(page, editedName);

    await page.reload();
    await showFarmInList(page, editedName);

    await page.getByRole('button', { name: `Hapus lahan ${editedName}` }).click();
    await expect(page.getByRole('dialog', { name: 'Hapus lahan?' })).toBeVisible();
    await page.getByRole('button', { name: 'Batal' }).click();
    await expect(farmNameCell(page, editedName)).toBeVisible();

    await page.getByRole('button', { name: `Hapus lahan ${editedName}` }).click();
    await page.getByRole('button', { name: 'Ya, Hapus' }).click();
    await expect(page.getByRole('status')).toContainText('Lahan berhasil dihapus.');
    await expect(farmNameCell(page, editedName)).toHaveCount(0);
  });

  test('blocked farm delete shows dependency message', async ({ page }) => {
    await page.goto('/farms');
    const suffix = Date.now();
    const farmName = e2eFarmName('Blocked');

    await page.getByRole('button', { name: '+ Tambah Lahan' }).click();
    await page.getByLabel('Nama Lahan').fill(farmName);
    await page.locator('#farm-location').fill(`Blocked ${suffix}`);
    await page.getByRole('button', { name: 'Simpan' }).click();
    await expect(page.getByRole('status')).toContainText('Lahan baru berhasil disimpan.');

    await page.goto('/crop-cycles');
    await page.getByRole('button', { name: '+ Tambah Siklus' }).click();
    await selectFarmOption(page, farmName);
    await page.locator('#cycle-date').fill('2031-01-15');
    await page.locator('#cycle-area').fill('0.55');
    await page.locator('#cycle-location').fill('Blok Blocked');
    await page.getByRole('button', { name: 'Simpan Siklus' }).click();
    await expect(page.getByRole('status')).toContainText('Siklus tanam baru berhasil disimpan.');

    await page.goto('/farms');
    await showFarmInList(page, farmName);
    await page.getByRole('button', { name: `Hapus lahan ${farmName}` }).click();
    await page.getByRole('button', { name: 'Ya, Hapus' }).click();
    await expect(page.locator('.alert-error')).toContainText(/siklus tanam/i);
    await expect(farmNameCell(page, farmName)).toBeVisible();
  });
});

test.describe('Crop cycle CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsE2E(page);
  });

  test('create, edit, verify persistence, delete cycle without predictions', async ({ page }) => {
    await page.goto('/crop-cycles');
    const suffix = Date.now();
    const uniqueDate = `2032-07-${String((suffix % 28) + 1).padStart(2, '0')}`;
    const uniqueArea = Number((((suffix % 9000) + 1000) / 10000).toFixed(2));
    const areaLabel = `${uniqueArea.toFixed(2)} ha`;
    const location = `Blok CRUD ${suffix}`;

    await page.getByRole('button', { name: '+ Tambah Siklus' }).click();
    await selectFirstFarm(page);
    await page.locator('#cycle-date').fill(uniqueDate);
    await page.locator('#cycle-area').fill(String(uniqueArea));
    await page.locator('#cycle-location').fill(location);
    await page.getByRole('button', { name: 'Simpan Siklus' }).click();
    await expect(page.getByRole('status')).toContainText('Siklus tanam baru berhasil disimpan.');
    await showAllListRows(page);

    const row = page.getByRole('row').filter({ hasText: uniqueDate }).filter({ hasText: areaLabel });
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: new RegExp(`Ubah siklus.*${uniqueDate}`) }).click();
    const editedLocation = `${location} Diubah`;
    await page.getByLabel('Lokasi Spesifik').fill(editedLocation);
    await page.getByRole('button', { name: 'Simpan Perubahan' }).click();
    await expect(page.getByRole('status')).toContainText('Perubahan siklus tanam berhasil disimpan.');

    await page.reload();
    await showAllListRows(page);
    await page.getByRole('button', { name: new RegExp(`Ubah siklus.*${uniqueDate}`) }).click();
    await expect(page.getByLabel('Lokasi Spesifik')).toHaveValue(editedLocation);
    await page.locator('.card').filter({ hasText: 'Ubah Siklus Tanam' }).getByRole('button', { name: 'Batal' }).click();

    await page.getByRole('button', { name: new RegExp(`Hapus siklus.*${uniqueDate}`) }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Batal' }).click();
    await expect(page.getByRole('row').filter({ hasText: uniqueDate })).toBeVisible();

    await page.getByRole('button', { name: new RegExp(`Hapus siklus.*${uniqueDate}`) }).click();
    await page.getByRole('button', { name: 'Ya, Hapus' }).click();
    await expect(page.getByRole('status')).toContainText('Siklus tanam berhasil dihapus.');
    await expect(page.getByRole('row').filter({ hasText: uniqueDate })).toHaveCount(0);
  });

  test('blocked cycle delete shows prediction dependency message', async ({ page }) => {
    await page.goto('/crop-cycles');
    const suffix = Date.now();
    const uniqueDate = `2033-08-${String((suffix % 28) + 1).padStart(2, '0')}`;
    const uniqueArea = Number((0.01 + (suffix % 9700) / 10000).toFixed(2));
    const areaLabel = `${uniqueArea.toFixed(2)} ha`;

    await page.getByRole('button', { name: '+ Tambah Siklus' }).click();
    await selectFirstFarm(page);
    await page.locator('#cycle-date').fill(uniqueDate);
    await page.locator('#cycle-area').fill(String(uniqueArea));
    await page.locator('#cycle-location').fill(`Pred Block ${suffix}`);
    const createResp = page.waitForResponse(
      (r) => r.url().includes('/crop-cycles') && r.request().method() === 'POST' && r.status() === 200,
    );
    await page.getByRole('button', { name: 'Simpan Siklus' }).click();
    const created = await (await createResp).json();
    expect(created.id).toBeTruthy();

    await page.evaluate(async (cycleId: string) => {
      const session = await fetch('/api/v1/auth/session', { credentials: 'include' });
      if (!session.ok) {
        throw new Error(`session failed: ${session.status}`);
      }
      const { csrf_token: csrf } = await session.json();
      const harvest = await fetch('/api/v1/features/harvest', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf,
        },
        body: JSON.stringify({ crop_cycle_id: cycleId, variety_key: 'ciherang' }),
      });
      if (!harvest.ok) {
        throw new Error(await harvest.text());
      }
    }, created.id);

    await page.goto('/crop-cycles');
    await showAllListRows(page);
    const row = page.getByRole('row').filter({ hasText: uniqueDate }).filter({ hasText: areaLabel });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: new RegExp(`Hapus siklus.*${uniqueDate}`) }).click();
    await page.getByRole('button', { name: 'Ya, Hapus' }).click();
    await expect(page.locator('.alert-error')).toContainText(/riwayat prediksi/i);
    await expect(row).toBeVisible();
  });
});
