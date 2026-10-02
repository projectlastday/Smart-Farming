import { apiFetch } from './api';
import type { CropCycle, Farm } from '@/types';

export async function listFarms(): Promise<Farm[]> {
  return apiFetch<Farm[]>('/farms');
}

export async function createFarm(payload: { name: string; location: string }): Promise<Farm> {
  return apiFetch<Farm>('/farms', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateFarm(
  farmId: string,
  payload: { name: string; location: string },
): Promise<Farm> {
  return apiFetch<Farm>(`/farms/${farmId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteFarm(farmId: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/farms/${farmId}`, {
    method: 'DELETE',
  });
}

const CROP_CYCLES_CACHE = 'agrifusion_crop_cycles';

export async function listCropCycles(): Promise<CropCycle[]> {
  const readCache = (): CropCycle[] | null => {
    try {
      const raw = sessionStorage.getItem(CROP_CYCLES_CACHE);
      return raw ? (JSON.parse(raw) as CropCycle[]) : null;
    } catch {
      return null;
    }
  };

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const cached = readCache();
    if (cached) return cached;
  }

  try {
    const data = await apiFetch<CropCycle[]>('/crop-cycles');
    try {
      sessionStorage.setItem(CROP_CYCLES_CACHE, JSON.stringify(data));
    } catch {
      /* ignore quota */
    }
    return data;
  } catch (err) {
    const cached = readCache();
    if (cached && typeof navigator !== 'undefined' && !navigator.onLine) {
      return cached;
    }
    throw err;
  }
}

export async function createCropCycle(
  farmId: string,
  payload: {
    crop: string;
    variety: string;
    planting_date: string;
    area: number;
    location: string;
    lifecycle_status?: string;
    soil_inputs?: Record<string, unknown>;
  },
): Promise<CropCycle> {
  return apiFetch<CropCycle>(`/farms/${farmId}/crop-cycles`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateCropCycle(
  cycleId: string,
  payload: {
    farm_id?: string;
    crop: string;
    variety: string;
    planting_date: string;
    area: number;
    location: string;
    lifecycle_status?: string;
    soil_inputs?: Record<string, unknown>;
  },
): Promise<CropCycle> {
  return apiFetch<CropCycle>(`/crop-cycles/${cycleId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteCropCycle(cycleId: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/crop-cycles/${cycleId}`, {
    method: 'DELETE',
  });
}

export async function markActualHarvest(
  cycleId: string,
  payload: {
    actual_harvest_date: string;
    actual_yield?: number | null;
    yield_unit?: string | null;
  },
): Promise<CropCycle> {
  return apiFetch<CropCycle>(`/crop-cycles/${cycleId}/harvest`, {
    method: 'POST',
    body: JSON.stringify({ crop_cycle_id: cycleId, ...payload }),
  });
}
