import { apiFetch } from './api';
import type { Prediction, PredictionList, SyncPredictionPayload } from '@/types';

export type PredictionQuery = {
  cropCycleId?: string;
  farmId?: string;
  featureType?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  latestPerFeature?: boolean;
};

function toQuery(params: PredictionQuery): string {
  const search = new URLSearchParams();
  if (params.cropCycleId) search.set('crop_cycle_id', params.cropCycleId);
  if (params.farmId) search.set('farm_id', params.farmId);
  if (params.featureType) search.set('feature_type', params.featureType);
  if (params.status) search.set('status', params.status);
  if (params.dateFrom) search.set('date_from', params.dateFrom);
  if (params.dateTo) search.set('date_to', params.dateTo);
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('page_size', String(params.pageSize));
  if (params.latestPerFeature) search.set('latest_per_feature', 'true');
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export async function listPredictions(params: PredictionQuery = {}): Promise<PredictionList> {
  return apiFetch<PredictionList>(`/predictions${toQuery(params)}`);
}

export async function getPrediction(id: string): Promise<Prediction> {
  return apiFetch<Prediction>(`/predictions/${id}`);
}

export async function syncPrediction(payload: SyncPredictionPayload): Promise<Prediction> {
  return apiFetch<Prediction>('/predictions/sync', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
