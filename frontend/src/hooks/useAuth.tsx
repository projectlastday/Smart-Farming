import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSession, logout as apiLogout } from '@/services/auth';
import { ApiClientError, setCsrfToken } from '@/services/api';
import type { User } from '@/types';

const LAST_USER_KEY = 'agrifusion_last_user';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isOfflineSession: boolean;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readCachedUser(): User | null {
  try {
    const raw = sessionStorage.getItem(LAST_USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: User | null): void {
  if (!user) {
    sessionStorage.removeItem(LAST_USER_KEY);
    return;
  }
  sessionStorage.setItem(LAST_USER_KEY, JSON.stringify(user));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [bootstrapped, setBootstrapped] = useState(false);
  const [offlineUser, setOfflineUser] = useState<User | null>(null);

  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: fetchSession,
    retry: false,
    enabled: bootstrapped,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    setBootstrapped(true);
  }, []);

  useEffect(() => {
    const restore = () => {
      void (async () => {
        try {
          const session = await fetchSession();
          if (session?.user) {
            qc.setQueryData(['session'], session);
          }
        } catch {
          /* Keep the last known local session until a write is rejected. */
        }
      })();
    };
    window.addEventListener('online', restore);
    return () => window.removeEventListener('online', restore);
  }, [qc]);

  useEffect(() => {
    if (sessionQuery.data?.user) {
      writeCachedUser(sessionQuery.data.user);
      setOfflineUser(null);
      return;
    }
    const err = sessionQuery.error;
    const status = err instanceof ApiClientError ? err.status : 0;
    const networkOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (status === 401 && !networkOffline) {
      writeCachedUser(null);
      setOfflineUser(null);
      return;
    }
    if (sessionQuery.data === null && !networkOffline && !sessionQuery.isError) {
      writeCachedUser(null);
      setOfflineUser(null);
      return;
    }
    if (networkOffline || status === 0 || err instanceof TypeError) {
      const cached = readCachedUser();
      if (cached) {
        setOfflineUser(cached);
      }
    }
  }, [sessionQuery.data, sessionQuery.isError, sessionQuery.error]);

  const refreshSession = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ['session'] });
  }, [qc]);

  const logout = useCallback(async () => {
    await apiLogout();
    setCsrfToken(null);
    writeCachedUser(null);
    setOfflineUser(null);
    qc.setQueryData(['session'], null);
    await qc.invalidateQueries();
  }, [qc]);

  const user = sessionQuery.data?.user ?? offlineUser;
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading: !bootstrapped || sessionQuery.isLoading,
      isAuthenticated: Boolean(user),
      isOfflineSession: Boolean(offlineUser) && !sessionQuery.data?.user,
      refreshSession,
      logout,
    }),
    [user, sessionQuery.isLoading, sessionQuery.data, offlineUser, bootstrapped, refreshSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
