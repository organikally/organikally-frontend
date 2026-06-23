// Session/auth store. Token is held in the native secure store (or localStorage
// fallback) via the bridge; user profile is kept in memory + IndexedDB kv.

import { create } from 'zustand';
import { api, setAuthToken } from '@/lib/api/client';
import { bridge, AUTH_TOKEN_KEY } from '@/lib/bridge/client';
import { kvGet, kvSet, clearAll } from '@/lib/offline/db';
import { runBootstrap } from '@/lib/offline/bootstrap';
import type { User } from '@/types/models';

// Conventional secure-store key from the native bridge protocol
// (organikally.auth.token) — see organikally-app/BRIDGE.md §3 secureStore.
const TOKEN_KEY = AUTH_TOKEN_KEY;

interface SessionState {
  user: User | null;
  token: string | null;
  ready: boolean; // session restore attempted
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  restore: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  user: null,
  token: null,
  ready: false,
  loading: false,
  error: null,

  async login(email, password) {
    set({ loading: true, error: null });
    try {
      const res = await api.login({ email, password });
      setAuthToken(res.access_token);
      await bridge.secureSet(TOKEN_KEY, res.access_token);
      await kvSet('user', res.user);
      set({ user: res.user, token: res.access_token, loading: false });
      // Register push token (best-effort) and pull offline bootstrap.
      void registerPush();
      void runBootstrap().catch(() => {});
    } catch (e) {
      set({ loading: false, error: (e as Error).message || 'Login failed' });
      throw e;
    }
  },

  async restore() {
    try {
      const token = await bridge.secureGet(TOKEN_KEY);
      if (!token) {
        set({ ready: true });
        return;
      }
      setAuthToken(token);
      const cachedUser = await kvGet<User>('user');
      if (cachedUser) set({ user: cachedUser, token });
      // Verify token if online; keep cached session if offline.
      if (navigator.onLine) {
        try {
          const user = await api.me();
          await kvSet('user', user);
          set({ user, token });
          void runBootstrap().catch(() => {});
        } catch {
          // token invalid/expired and online → drop session
          await bridge.secureDelete(TOKEN_KEY);
          setAuthToken(null);
          set({ user: null, token: null });
        }
      }
    } finally {
      set({ ready: true });
    }
  },

  async logout() {
    try {
      if (navigator.onLine) await api.logout().catch(() => {});
    } finally {
      await bridge.secureDelete(TOKEN_KEY);
      setAuthToken(null);
      await clearAll();
      set({ user: null, token: null });
    }
  },
}));

async function registerPush(): Promise<void> {
  try {
    const t = await bridge.getPushToken();
    if (t?.token && navigator.onLine) await api.registerPushToken(t.token);
  } catch {
    /* best-effort */
  }
}
