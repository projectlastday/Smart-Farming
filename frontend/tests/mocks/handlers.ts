import { http, HttpResponse } from 'msw';

export const farmFixture = {
  id: 'farm-1',
  name: 'Sawah Ngemplak',
  location: 'Semarang, Jawa Tengah',
  farmer_id: 'user-1',
};

export const predictionListFixture = {
  items: [
    {
      id: 'pred-1',
      feature_type: 'harvest',
      model_version: 'harvest-duration-v1',
      inputs_snapshot: {},
      output: { growth_stage: 'vegetative', status: 'ok' },
      confidence: null,
      assumptions: 'Durasi varietas',
      explanation: 'Tahap pertumbuhan: Vegetatif',
      recommendation: 'Pantau kondisi lapangan',
      provenance: { mode: 'demo_fallback' },
      client_operation_id: 'op-1',
      created_at: '2026-09-01T00:00:00',
      crop_cycle_id: 'cycle-1',
      farm_id: 'farm-1',
    },
  ],
  page: 1,
  page_size: 20,
  total: 1,
  total_pages: 1,
};

export const sessionFixture = {
  user: {
    id: 'user-1',
    name: 'Budi Santoso',
    email: 'petani@gmail.com',
    phone: null,
    role: 'farmer',
    status: 'active',
    must_change_password: false,
  },
  csrf_token: 'csrf-test-token',
};

export const handlers = [
  http.get(/\/api\/v1\/auth\/session$/, () => HttpResponse.json(sessionFixture)),
  http.get(/\/api\/v1\/farms$/, () => HttpResponse.json([farmFixture])),
  http.get(/\/api\/v1\/predictions$/, ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('page_size') ?? '20');
    return HttpResponse.json({
      ...predictionListFixture,
      page,
      page_size: pageSize,
    });
  }),
  http.post(/\/api\/v1\/farms$/, async ({ request }) => {
    const body = (await request.json()) as { name: string; location: string };
    return HttpResponse.json(
      { id: 'farm-2', farmer_id: 'user-1', name: body.name, location: body.location },
      { status: 200 },
    );
  }),
];
