import { apiFetch, getApiBase } from './api';
import type { DiseaseModelMetadata, Prediction } from '@/types';

export async function runHarvest(
  cropCycleId: string,
  varietyKey?: string,
): Promise<Prediction> {
  return apiFetch<Prediction>('/features/harvest', {
    method: 'POST',
    body: JSON.stringify({ crop_cycle_id: cropCycleId, variety_key: varietyKey }),
  });
}

export async function runSoil(payload: {
  crop_cycle_id: string;
  ph: number;
  moisture: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  input_provenance?: string;
}): Promise<Prediction> {
  return apiFetch<Prediction>('/features/soil', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function runRejuvenation(payload: {
  crop_cycle_id: string;
  orchard_age: number;
  productivity_decline: string;
  canopy_condition: string;
}): Promise<Prediction> {
  return apiFetch<Prediction>('/features/rejuvenation', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function runDisease(
  cropCycleId: string,
  image: File,
  saveImage = false,
  context?: Record<string, unknown>,
): Promise<Prediction> {
  const form = new FormData();
  form.append('crop_cycle_id', cropCycleId);
  form.append('image', image);
  form.append('save_image', String(saveImage));
  if (context) {
    form.append('context_json', JSON.stringify(context));
  }
  return apiFetch<Prediction>('/features/disease', {
    method: 'POST',
    body: form,
  });
}

export async function fetchDiseaseModelMetadata(): Promise<DiseaseModelMetadata> {
  return apiFetch<DiseaseModelMetadata>('/features/disease/model/metadata', {
    skipCsrf: true,
  });
}

export function resolveModelUrl(relativeUrl: string): string {
  if (relativeUrl.startsWith('http')) {
    return relativeUrl;
  }
  const base = getApiBase().replace(/\/api\/v1$/, '');
  return `${base}${relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`}`;
}

export async function checkHealth(): Promise<{ status: string }> {
  return apiFetch('/health/live', { skipCsrf: true });
}

export async function checkReady(): Promise<{
  status: string;
  database: string;
  model_available: boolean;
}> {
  return apiFetch('/health/ready', { skipCsrf: true });
}
