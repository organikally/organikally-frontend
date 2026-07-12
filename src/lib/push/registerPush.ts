// Device push-token registration.
//
// Reads the Expo push token from the native bridge and stores it against the
// staff user (POST /auth/push-token). No-op in a plain browser (no native
// bridge) and while offline. Best-effort by design: it never throws and never
// blocks its caller (login / app resume must not wait on push).

import { api } from '@/lib/api/client';
import { bridge, hasNativeBridge } from '@/lib/bridge/client';

let inFlight = false;

export async function registerPushToken(): Promise<void> {
  if (inFlight) return; // collapse concurrent resume/login calls
  inFlight = true;
  try {
    if (!hasNativeBridge()) return; // plain browser — nothing to register
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const t = await bridge.getPushToken();
    if (!t?.token) return;
    await api.registerPushToken(t.token, t.platform);
  } catch {
    /* best-effort — swallow bridge/network errors */
  } finally {
    inFlight = false;
  }
}
