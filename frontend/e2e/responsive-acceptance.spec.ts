import { test, expect, type Page } from '@playwright/test';
import { KNOWN_GOOD_BLAST, loginAsDemo, loginAsSuperadmin } from './session';
import {
  MOBILE_ACCEPTANCE_VIEWPORTS,
  assertDialogFits,
  assertAuthCardCentered,
  assertLayout,
  closeMobileNav,
  openMobileNav,
} from './responsive';

const PUBLIC_ROUTES: { path: string; heading: RegExp }[] = [
  { path: '/login', heading: /AgriFusionNet/ },
  { path: '/register', heading: /Daftar Petani/ },
  { path: '/this-route-does-not-exist', heading: /Halaman tidak ditemukan/ },
];

const FARMER_ROUTES: { path: string; heading: RegExp }[] = [
  { path: '/dashboard', heading: /Selamat datang/ },
  { path: '/analysis', heading: /Analisis Tanaman/ },
  { path: '/farms', heading: /Kelola Lahan/ },
  { path: '/crop-cycles', heading: /Siklus Tanam/ },
  { path: '/predictions', heading: /Riwayat Prediksi/ },
  { path: '/features/harvest', heading: /Prediksi Waktu Panen Padi/ },
  { path: '/features/soil', heading: /Analisis Kondisi Tanah/ },
  { path: '/features/disease', heading: /Diagnosis Penyakit Daun Padi/ },
  { path: '/features/rejuvenation', heading: /Rejuvenasi Kebun Jambu/ },
  { path: '/features/offline', heading: /AI Offline/ },
];

const ADMIN_ROUTES: { path: string; heading: RegExp }[] = [
  { path: '/admin/farmers', heading: /Kelola Akun Petani/ },
  { path: '/admin/reference', heading: /Referensi Pertanian/ },
  { path: '/admin/audit', heading: /Log Audit/ },
];

async function selectFirstOption(page: Page, name: string, optionHint: RegExp): Promise<void> {
  const combo = page.getByRole('combobox', { name });
  await expect(combo).toBeVisible({ timeout: 15_000 });
  await combo.click();
  await page.getByRole('option', { name: optionHint }).first().click();
}

async function visitHeading(page: Page, path: string, heading: RegExp): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({ timeout: 15_000 });
}

test.describe('Responsive acceptance 375 portrait and 667x375 landscape', () => {
  test.use({ serviceWorkers: 'block' });
  for (const viewport of MOBILE_ACCEPTANCE_VIEWPORTS) {
    test.describe(viewport.name, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
      });

      test('public routes stay usable', async ({ page }) => {
        for (const route of PUBLIC_ROUTES) {
          await visitHeading(page, route.path, route.heading);
          await assertAuthCardCentered(page);
          await assertLayout(page, `${viewport.name}${route.path.replaceAll('/', '-') || '-root'}`);
        }
      });

      test('farmer routes, nav, forms, dialogs, and results', async ({ page }) => {
        test.setTimeout(180_000);
        await loginAsDemo(page);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        for (const route of FARMER_ROUTES) {
          await visitHeading(page, route.path, route.heading);
          await assertLayout(page, `${viewport.name}${route.path.replaceAll('/', '-')}`);
        }

        await page.goto('/dashboard');
        await openMobileNav(page);
        await expect(page.locator('#navbar-links').getByRole('link', { name: 'Dasbor' })).toBeVisible();
        await expect(page.locator('#navbar-links').getByRole('link', { name: 'Lahan', exact: true })).toBeVisible();
        await expect(page.locator('#navbar-links').getByRole('link', { name: 'Siklus Tanam' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Keluar' })).toBeVisible();
        await assertLayout(page, `${viewport.name}-nav-open`);
        await closeMobileNav(page);

        await page.goto('/farms');
        await page.getByRole('button', { name: '+ Tambah Lahan' }).click();
        await expect(page.getByRole('heading', { name: 'Tambah Lahan Baru' })).toBeVisible();
        await assertLayout(page, `${viewport.name}-farms-create`);
        const hapus = page.getByRole('button', { name: /Hapus lahan/ }).first();
        await hapus.click();
        await assertDialogFits(page);
        await assertLayout(page, `${viewport.name}-farms-dialog`);
        await page.getByRole('dialog').getByRole('button', { name: 'Batal' }).click();

        await page.goto('/crop-cycles');
        await page.getByRole('button', { name: '+ Tambah Siklus' }).click();
        await expect(page.getByRole('heading', { name: 'Tambah Siklus Tanam' })).toBeVisible();
        await assertLayout(page, `${viewport.name}-cycles-create`);

        await page.goto('/predictions');
        await page.getByRole('link', { name: 'Buka detail' }).first().click();
        await expect(page.getByRole('heading', { name: 'Detail Prediksi' })).toBeVisible({ timeout: 15_000 });
        await page.getByText('Metadata rekaman').click();
        await assertLayout(page, `${viewport.name}-prediction-detail`);

        await page.goto('/predictions/00000000-0000-0000-0000-000000000000');
        await expect(page.getByText('Prediksi tidak ditemukan.')).toBeVisible();
        await assertLayout(page, `${viewport.name}-prediction-missing`);

        await page.goto('/analysis');
        await expect(page.getByRole('heading', { name: 'Daftar prediksi' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Buka' }).first()).toBeVisible({ timeout: 15_000 });
        await expect(page.getByRole('combobox', { name: 'Lahan' })).toBeVisible();
        await expect(page.getByRole('combobox', { name: 'Fitur' })).toBeVisible();
        await assertLayout(page, `${viewport.name}-analysis-filled`);

        await page.goto('/features/harvest');
        await selectFirstOption(page, 'Siklus Tanam', /Padi/i);
        await page.getByRole('button', { name: 'Prediksi Panen' }).click();
        await expect(page.getByRole('heading', { name: 'Prediksi Panen', level: 3 })).toBeVisible({
          timeout: 20_000,
        });
        await assertLayout(page, `${viewport.name}-harvest-result`);

        await page.goto('/features/soil');
        await selectFirstOption(page, 'Siklus Tanam', /Padi|Jambu/i);
        await page.getByRole('button', { name: 'Analisis Tanah' }).click();
        await expect(page.getByRole('heading', { name: /^Hasil:/ })).toBeVisible({
          timeout: 20_000,
        });
        await assertLayout(page, `${viewport.name}-soil-result`);

        await page.goto('/features/disease');
        await page.locator('#leaf-image').setInputFiles(KNOWN_GOOD_BLAST);
        await expect(page.getByAltText('Pratinjau daun')).toBeVisible();
        await assertLayout(page, `${viewport.name}-disease-preview`);

        await page.goto('/features/offline');
        await expect(page.getByRole('heading', { name: /Diagnosis Offline/i })).toBeVisible();
        await expect(page.getByText('Antrian offline kosong')).toBeVisible();
        await assertLayout(page, `${viewport.name}-offline-states`);
      });

      test('farmer empty, loading, and error states', async ({ page }) => {
        test.setTimeout(90_000);
        await loginAsDemo(page);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        await page.goto('/farms');
        await page.getByLabel('Cari lahan').fill('zzz-no-such-farm-xyz');
        await expect(page.getByText('Tidak ada lahan yang cocok dengan filter.')).toBeVisible();
        await assertLayout(page, `${viewport.name}-farms-empty-filter`);

        await page.route('**/api/v1/predictions*', async (route) => {
          if (route.request().method() !== 'GET') {
            await route.continue();
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 1500));
          await route.continue();
        });
        const loadingNav = page.goto('/predictions');
        await expect(page.getByRole('status', { name: 'Memuat...' })).toBeVisible({ timeout: 5_000 });
        await assertLayout(page, `${viewport.name}-predictions-loading`);
        await loadingNav;
        await page.unroute('**/api/v1/predictions*');

        const errorPage = await page.context().newPage();
        await errorPage.setViewportSize({ width: viewport.width, height: viewport.height });
        await errorPage.route(
          (url) => url.pathname.replace(/\/$/, '') === '/api/v1/farms',
          async (route) => {
            if (route.request().method() !== 'GET') {
              await route.continue();
              return;
            }
            await route.fulfill({
              status: 500,
              contentType: 'application/json',
              body: JSON.stringify({ detail: { message: 'simulated failure' } }),
            });
          },
        );
        await loginAsDemo(errorPage);
        await expect(errorPage.getByRole('button', { name: 'Coba lagi' })).toBeVisible();
        await assertLayout(errorPage, `${viewport.name}-dashboard-error`);
        await errorPage.close();
      });

      test('admin and superadmin routes plus nav', async ({ page }) => {
        test.setTimeout(90_000);
        await loginAsSuperadmin(page);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });

        for (const route of ADMIN_ROUTES) {
          await visitHeading(page, route.path, route.heading);
          await assertLayout(page, `${viewport.name}${route.path.replaceAll('/', '-')}`);
        }

        await page.goto('/dashboard');
        await openMobileNav(page);
        await expect(page.locator('#navbar-links').getByRole('link', { name: 'Admin' })).toBeVisible();
        await expect(page.locator('#navbar-links').getByRole('link', { name: 'Referensi' })).toBeVisible();
        await expect(page.locator('#navbar-links').getByRole('link', { name: 'Log Audit' })).toBeVisible();
        await assertLayout(page, `${viewport.name}-superadmin-nav-open`);
        await closeMobileNav(page);
      });
    });
  }
});
