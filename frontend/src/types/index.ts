export type UserRole = 'farmer' | 'admin' | 'superadmin';
export type UserStatus = 'active' | 'disabled';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  must_change_password: boolean;
}

export interface Session {
  user: User;
  csrf_token: string;
}

export interface Farm {
  id: string;
  name: string;
  location: string;
  farmer_id: string;
}

export interface CropCycle {
  id: string;
  farm_id: string;
  crop: string;
  variety: string;
  planting_date: string;
  area: number;
  location: string;
  lifecycle_status: string;
  actual_harvest_date?: string | null;
  actual_yield?: number | null;
  yield_unit?: string | null;
}

export interface Prediction {
  id: string;
  feature_type: string;
  model_version: string;
  inputs_snapshot: Record<string, unknown>;
  output: Record<string, unknown>;
  confidence: number | null;
  assumptions: string | null;
  explanation: string | null;
  recommendation: string | null;
  provenance: Record<string, unknown> | null;
  client_operation_id: string;
  created_at: string;
  crop_cycle_id: string;
  farm_id: string;
}

export interface PredictionList {
  items: Prediction[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface SyncPredictionPayload {
  client_operation_id: string;
  farm_id: string;
  crop_cycle_id: string;
  feature_type: string;
  model_version: string;
  inputs_snapshot: Record<string, unknown>;
  output: Record<string, unknown>;
  confidence?: number | null;
  assumptions?: string | null;
  explanation?: string | null;
  recommendation?: string | null;
  provenance?: Record<string, unknown> | null;
}

export interface ApiError {
  detail: string | { code?: string; message?: string };
}

export interface DiseaseModelMetadata {
  version: string;
  model_url?: string;
  labels?: string[];
  classes?: string[];
  input_size: number[];
  mean?: number[];
  std?: number[];
  confidence_threshold?: number;
  hash?: string;
  size_bytes?: number;
  mode?: string;
  limitations?: string[];
}

export interface QueuedOperation {
  id?: number;
  client_operation_id: string;
  payload: SyncPredictionPayload;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  error?: string;
  created_at: string;
  retry_count: number;
}

export const FEATURE_LABELS: Record<string, string> = {
  harvest: 'Prediksi Panen',
  soil: 'Analisis Tanah',
  disease: 'Diagnosis Penyakit',
  rejuvenation: 'Rejuvenasi Jambu',
  mapping: 'Pemetaan Lahan',
  offline: 'AI Offline',
};

export const CROP_OPTIONS = [
  { value: 'rice', label: 'Padi' },
  { value: 'guava', label: 'Jambu Biji' },
];

export const VARIETY_OPTIONS = [
  { value: 'ciherang', label: 'Ciherang' },
  { value: 'ir64', label: 'IR64' },
  { value: 'inpari32', label: 'Inpari 32' },
];

export const LIFECYCLE_OPTIONS = [
  { value: 'planned', label: 'Direncanakan' },
  { value: 'planted', label: 'Ditanam' },
  { value: 'growing', label: 'Tumbuh' },
  { value: 'harvest-ready', label: 'Siap Panen' },
  { value: 'harvested', label: 'Sudah Panen' },
  { value: 'archived', label: 'Diarsipkan' },
];
