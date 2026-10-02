import { apiFetch, ApiClientError, setCsrfToken } from './api';
import type { Session, User } from '@/types';

const LAST_SESSION_KEY = 'agrifusion_last_session';
const LAST_USER_KEY = 'agrifusion_last_user';

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

function readCachedSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(LAST_SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function writeCachedSession(session: Session | null): void {
  try {
    if (!session) {
      sessionStorage.removeItem(LAST_SESSION_KEY);
      sessionStorage.removeItem(LAST_USER_KEY);
      return;
    }
    sessionStorage.setItem(LAST_SESSION_KEY, JSON.stringify(session));
    sessionStorage.setItem(LAST_USER_KEY, JSON.stringify(session.user));
  } catch {
    /* ignore quota */
  }
}

function restoreCachedSession(): Session | null {
  const cached = readCachedSession();
  if (!cached?.csrf_token || !cached.user) return null;
  setCsrfToken(cached.csrf_token);
  return cached;
}

export async function fetchSession(): Promise<Session | null> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return restoreCachedSession();
  }
  try {
    const session = await apiFetch<Session>('/auth/session');
    setCsrfToken(session.csrf_token);
    writeCachedSession(session);
    return session;
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 401) {
      setCsrfToken(null);
      writeCachedSession(null);
      return null;
    }
    const cached = restoreCachedSession();
    if (cached) return cached;
    throw err;
  }
}

export async function register(payload: RegisterPayload): Promise<Session> {
  const session = await apiFetch<Session>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
    skipCsrf: true,
  });
  setCsrfToken(session.csrf_token);
  writeCachedSession(session);
  return session;
}

export async function login(payload: LoginPayload): Promise<Session> {
  const session = await apiFetch<Session>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
    skipCsrf: true,
  });
  setCsrfToken(session.csrf_token);
  writeCachedSession(session);
  return session;
}

export async function logout(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' });
  setCsrfToken(null);
  writeCachedSession(null);
}

export async function createAdminUser(payload: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: string;
}): Promise<User> {
  return apiFetch('/auth/admin/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type { User };
