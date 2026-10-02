import type { ApiError } from '@/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
const CSRF_STORAGE_KEY = 'agrifusion_csrf';

function readStoredCsrf(): string | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(CSRF_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredCsrf(token: string | null): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (!token) {
      sessionStorage.removeItem(CSRF_STORAGE_KEY);
    } else {
      sessionStorage.setItem(CSRF_STORAGE_KEY, token);
    }
  } catch {
    /* private mode / quota */
  }
}

let csrfToken: string | null = readStoredCsrf();

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
  writeStoredCsrf(token);
}

export function getCsrfToken(): string | null {
  return csrfToken ?? readStoredCsrf();
}

export class ApiClientError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

function parseErrorMessage(detail: ApiError['detail'] | string): { message: string; code?: string } {
  if (typeof detail === 'string') {
    return { message: detail };
  }
  return {
    message: detail.message ?? 'Terjadi kesalahan',
    code: detail.code,
  };
}

function indonesianStatus(status: number): string {
  if (status === 401) return 'Sesi tidak valid. Silakan masuk kembali.';
  if (status === 403) return 'Akses ditolak.';
  if (status === 404) return 'Data tidak ditemukan.';
  if (status === 409) return 'Tidak dapat dihapus karena masih memiliki data terkait.';
  if (status === 429) return 'Terlalu banyak permintaan. Coba lagi nanti.';
  if (status >= 500) return 'Server sedang bermasalah. Coba lagi.';
  return 'Terjadi kesalahan.';
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { skipCsrf?: boolean } = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const csrf = getCsrfToken();
  if (!options.skipCsrf && csrf && options.method && options.method !== 'GET') {
    headers.set('X-CSRF-Token', csrf);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? (JSON.parse(text) as T | ApiError) : null;

  if (!response.ok) {
    const err = data as ApiError | null;
    const parsed = parseErrorMessage(err?.detail ?? indonesianStatus(response.status));
    throw new ApiClientError(response.status, parsed.message, parsed.code);
  }

  return data as T;
}

export function getApiBase(): string {
  return API_BASE;
}
