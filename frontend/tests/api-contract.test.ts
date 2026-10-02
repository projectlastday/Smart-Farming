import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { server } from './mocks/server';
import { farmFixture, predictionListFixture, sessionFixture } from './mocks/handlers';
import { ApiClientError, apiFetch, setCsrfToken } from '@/services/api';
import { listFarms, markActualHarvest } from '@/services/farms';
import { listPredictions } from '@/services/predictions';
import { http, HttpResponse } from 'msw';

describe('API contract via MSW', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });
  afterEach(() => {
    server.resetHandlers();
    setCsrfToken(null);
  });
  afterAll(() => server.close());

  it('loads session payload matching Session type', async () => {
    const session = await apiFetch<typeof sessionFixture>('/auth/session');
    expect(session.user.role).toBe('farmer');
    expect(session.csrf_token).toBe('csrf-test-token');
    expect(session.user.email).toContain('@');
  });

  it('lists farms as an array of farm records', async () => {
    const farms = await listFarms();
    expect(Array.isArray(farms)).toBe(true);
    expect(farms[0]).toEqual(farmFixture);
    expect(farms[0].name).toBe('Sawah Ngemplak');
  });

  it('lists predictions with pagination metadata', async () => {
    const listed = await listPredictions({ page: 1, pageSize: 20 });
    expect(listed.page).toBe(1);
    expect(listed.page_size).toBe(20);
    expect(listed.total).toBe(1);
    expect(listed.items[0].id).toBe(predictionListFixture.items[0].id);
    expect(listed.items[0].confidence).toBeNull();
    expect(listed.items[0].crop_cycle_id).toBe('cycle-1');
  });

  it('can request the global paginated prediction list used by Analisis Tanaman', async () => {
    let query = '';
    server.use(
      http.get(/\/api\/v1\/predictions$/, ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json(predictionListFixture);
      }),
    );
    await listPredictions({ page: 1, pageSize: 100 });
    const params = new URLSearchParams(query);
    expect(params.get('crop_cycle_id')).toBeNull();
    expect(params.get('latest_per_feature')).toBeNull();
    expect(params.get('page')).toBe('1');
    expect(params.get('page_size')).toBe('100');
  });

  it('sends CSRF header on mutating requests', async () => {
    setCsrfToken('csrf-test-token');
    let seen: string | null = null;
    server.use(
      http.post(/\/api\/v1\/farms$/, ({ request }) => {
        seen = request.headers.get('X-CSRF-Token');
        return HttpResponse.json({ id: 'farm-2', farmer_id: 'user-1', name: 'X', location: 'Y' });
      }),
    );
    const created = await apiFetch<{ id: string }>('/farms', {
      method: 'POST',
      body: JSON.stringify({ name: 'X', location: 'Y' }),
    });
    expect(created.id).toBe('farm-2');
    expect(seen).toBe('csrf-test-token');
  });

  it('maps 401 to an Indonesian session error and does not treat it as success', async () => {
    server.use(http.get(/\/api\/v1\/farms$/, () => HttpResponse.json({ detail: 'Sesi tidak valid' }, { status: 401 })));
    await expect(listFarms()).rejects.toMatchObject({
      status: 401,
      message: 'Sesi tidak valid',
    } satisfies Partial<ApiClientError>);
  });

  it('does not treat an empty prediction list as success when the session is invalid', async () => {
    server.use(
      http.get(/\/api\/v1\/predictions$/, () =>
        HttpResponse.json({ detail: 'Sesi tidak valid' }, { status: 401 }),
      ),
    );
    await expect(listPredictions({ cropCycleId: 'cycle-1' })).rejects.toMatchObject({
      status: 401,
    } satisfies Partial<ApiClientError>);
  });

  it('maps 500 to an Indonesian server error instead of an empty list', async () => {
    server.use(
      http.get(/\/api\/v1\/farms$/, () =>
        HttpResponse.json({ detail: 'Server sedang bermasalah. Coba lagi.' }, { status: 500 }),
      ),
    );
    await expect(listFarms()).rejects.toMatchObject({
      status: 500,
      message: 'Server sedang bermasalah. Coba lagi.',
    } satisfies Partial<ApiClientError>);
  });

  it('sends applicable status filter used by Riwayat Hasil berlaku', async () => {
    let query = '';
    server.use(
      http.get(/\/api\/v1\/predictions$/, ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json(predictionListFixture);
      }),
    );
    await listPredictions({ status: 'applicable', page: 1, pageSize: 20 });
    const params = new URLSearchParams(query);
    expect(params.get('status')).toBe('applicable');
  });

  it('posts actual harvest with CSRF and crop_cycle_id', async () => {
    setCsrfToken('csrf-test-token');
    const captured: { csrf: string | null; body: Record<string, unknown> | null } = {
      csrf: null,
      body: null,
    };
    server.use(
      http.post(/\/api\/v1\/crop-cycles\/cycle-1\/harvest$/, async ({ request }) => {
        captured.csrf = request.headers.get('X-CSRF-Token');
        captured.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          id: 'cycle-1',
          farm_id: 'farm-1',
          crop: 'rice',
          variety: 'Ciherang',
          planting_date: '2026-03-01',
          area: 0.75,
          location: 'Semarang',
          lifecycle_status: 'harvested',
          actual_harvest_date: '2026-07-01',
        });
      }),
    );
    const cycle = await markActualHarvest('cycle-1', { actual_harvest_date: '2026-07-01' });
    expect(captured.csrf).toBe('csrf-test-token');
    expect(captured.body?.crop_cycle_id).toBe('cycle-1');
    expect(captured.body?.actual_harvest_date).toBe('2026-07-01');
    expect(cycle.lifecycle_status).toBe('harvested');
    expect(cycle.actual_harvest_date).toBe('2026-07-01');
  });
});
