import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export const DEMO_EMAIL = 'petani@gmail.com';
export const DEMO_PASSWORD = process.env.DEMO_FARMER_PASSWORD ?? 'password';
export const E2E_EMAIL = 'e2e.farmer@agrifusion.test';
export const E2E_PASSWORD = process.env.E2E_FARMER_PASSWORD ?? 'E2eFarmer123!';
export const SUPERADMIN_EMAIL = 'superadmin@gmail.com';
export const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD ?? 'password';
export const APP_ORIGIN = (process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:8005').replace(/\/$/, '');
export const PUBLIC_ORIGIN = (process.env.PUBLIC_ORIGIN ?? 'https://sf.projectdunia.my.id').replace(/\/$/, '');

export const KNOWN_GOOD_BLAST = fileURLToPath(
  new URL('../../fixtures/disease/known_good/blast.jpg', import.meta.url),
);

export function e2eFarmName(kind: string): string {
  return `E2E-${kind}-${Date.now()}`;
}

export async function loginAs(
  page: Page,
  email = DEMO_EMAIL,
  password = DEMO_PASSWORD,
): Promise<void> {
  await page.goto('/login');
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Kata Sandi').fill(password);
    const loginRespPromise = page.waitForResponse(
      (response) => response.url().includes('/auth/login') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Masuk' }).click();
    const loginResp = await loginRespPromise;
    if (loginResp.status() === 429 || loginResp.status() === 502 || loginResp.status() === 503) {
      const retryAfterHeader = Number(loginResp.headers()['retry-after'] ?? '2');
      const waitMs = Math.min(Math.max(Number.isFinite(retryAfterHeader) ? retryAfterHeader : 2, 1), 60) * 1000;
      await page.waitForTimeout(waitMs);
      continue;
    }
    expect(loginResp.ok(), `login HTTP ${loginResp.status()}`).toBeTruthy();
    await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
    return;
  }
  throw new Error('Login still rate-limited after retries');
}

export async function loginAsE2E(page: Page): Promise<void> {
  await loginAs(page, E2E_EMAIL, E2E_PASSWORD);
}

export async function loginAsDemo(page: Page): Promise<void> {
  await loginAs(page, DEMO_EMAIL, DEMO_PASSWORD);
}

export async function loginAsSuperadmin(page: Page): Promise<void> {
  await loginAs(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
}

export async function apiLogin(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<{ csrf: string; origin: string }> {
  const loginResp = await request.post('/api/v1/auth/login', {
    data: { email, password },
    headers: { Origin: APP_ORIGIN },
  });
  expect(loginResp.ok(), `login HTTP ${loginResp.status()}`).toBeTruthy();
  const body = (await loginResp.json()) as { csrf_token: string };
  return { csrf: body.csrf_token, origin: APP_ORIGIN };
}

export function mutatingHeaders(csrf: string, origin = APP_ORIGIN): Record<string, string> {
  return {
    'X-CSRF-Token': csrf,
    Origin: origin,
    'Content-Type': 'application/json',
  };
}
