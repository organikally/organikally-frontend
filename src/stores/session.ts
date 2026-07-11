// Session/auth store. Token is held in the native secure store (or localStorage
// fallback) via the bridge; user profile is kept in memory + IndexedDB kv.

import { create } from 'zustand';
import { api, setAuthToken } from '@/lib/api/client';
import { bridge, AUTH_TOKEN_KEY } from '@/lib/bridge/client';
import { kvGet, kvSet, clearAll, purgeApiCaches } from '@/lib/offline/db';
import { runBootstrap } from '@/lib/offline/bootstrap';
import { syncEngine } from '@/lib/offline/sync';
import type { User } from '@/types/models';

// Conventional secure-store key from the native bridge protocol
// (organikaly.auth.token) — see organikally-app/BRIDGE.md §3 secureStore.
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
  // Token rejected mid-session (401): drop the session but KEEP the offline
  // queue so it replays after re-login. RequireAuth routes to /login reactively.
  sessionExpired: () => Promise<void>;
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
      syncEngine.resetAuth(); // resume draining after any prior token expiry
      set({ user: res.user, token: res.access_token, loading: false });
      // Register push token (best-effort) and pull offline bootstrap.
      void registerPush();
      void runBootstrap().catch(() => {});
      void syncEngine.sync();
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
      // Also purge the SW's cached API responses so the next rep on a shared
      // device doesn't see the previous rep's outlets/orders/visits.
      await purgeApiCaches();
      set({ user: null, token: null });
    }
  },

  async sessionExpired() {
    await bridge.secureDelete(TOKEN_KEY);
    setAuthToken(null);
    // Deliberately do NOT clearAll(): the outbound queue must survive so it can
    // replay once the rep signs back in.
    set({
      user: null,
      token: null,
      error: 'Your session expired. Please sign in again.',
    });
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
