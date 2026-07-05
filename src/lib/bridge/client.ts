// Typed native-bridge client with graceful plain-browser fallback.
//
// Inside the Expo shell the canonical client `window.OrganikalyBridge` is
// injected BEFORE the field app loads (see organikally-app/BRIDGE.md +
// src/bridge/protocol.ts). The field app calls that client directly — it does
// NOT re-implement the raw postMessage transport. In a plain browser the client
// is absent and we fall back to navigator.geolocation + <input capture> +
// localStorage.
//
// A legacy raw transport (matching the canonical {id,type,payload} request and
// the window.__organikalyDeliver response delivery) is retained only for shells
// that expose `window.ReactNativeWebView` without the injected client.

import { v4 as uuid } from 'uuid';
import {
  AUTH_TOKEN_KEY,
  type BridgeRequest,
  type BridgeRequestType,
  type BridgeResponse,
  type CameraCaptureData,
  type CameraCaptureResult,
  type LocationData,
  type LocationResult,
  type PushTokenResult,
} from './types';

export { AUTH_TOKEN_KEY };

const REQUEST_TIMEOUT_MS = 120_000;

// Native is available when the shell installed its canonical client. We also
// treat a bare ReactNativeWebView as native (legacy raw-transport path).
export function hasNativeBridge(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.OrganikalyBridge?.isNative || !!window.ReactNativeWebView;
}

function nativeClient() {
  return typeof window !== 'undefined' ? window.OrganikalyBridge : undefined;
}

// ---- Adapters: canonical data shapes -> field-internal result shapes ----

function adaptLocation(d: LocationData): LocationResult {
  return {
    lat: d.lat,
    lng: d.lng,
    accuracy: d.accuracy,
    is_mock: !!d.isMock, // canonical `isMock` -> field `is_mock`
    timestamp: d.timestamp,
  };
}

function adaptCamera(d: CameraCaptureData): CameraCaptureResult {
  return {
    // Prefer a data URL (for offline blob queueing); else fall back to the URI.
    dataUrl: d.base64 ? `data:${d.mimeType};base64,${d.base64}` : undefined,
    fileUri: d.uri,
    width: d.width,
    height: d.height,
  };
}

// ---- Legacy raw transport (canonical envelope, no injected client) ----
// Only used when window.ReactNativeWebView exists but OrganikalyBridge does not.

type Pending = {
  resolve: (data: unknown) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const pending = new Map<string, Pending>();

function handleIncoming(raw: unknown) {
  let msg: BridgeResponse | null = null;
  try {
    msg =
      typeof raw === 'string'
        ? (JSON.parse(raw) as BridgeResponse)
        : (raw as BridgeResponse);
  } catch {
    return;
  }
  if (!msg || typeof (msg as BridgeResponse).id !== 'string') return;
  const p = pending.get(msg.id);
  if (!p) return;
  clearTimeout(p.timer);
  pending.delete(msg.id);
  if (msg.ok) p.resolve(msg.data);
  else p.reject(new Error(msg.error?.message || 'bridge error'));
}

let listenerBound = false;
function ensureListener() {
  if (listenerBound || typeof window === 'undefined') return;
  // The shell delivers responses by calling window.__organikalyDeliver(json).
  // If the canonical injected client owns that hook we never bind here; this is
  // only for the legacy raw path.
  if (!window.__organikalyDeliver) {
    window.__organikalyDeliver = (json: string) => handleIncoming(json);
  }
  // Some shells also dispatch a 'message' event; tolerate that too.
  window.addEventListener('message', (e) => handleIncoming(e.data));
  document.addEventListener('message', (e) =>
    handleIncoming((e as MessageEvent).data),
  );
  listenerBound = true;
}

function callRaw(type: BridgeRequestType, payload?: unknown): Promise<unknown> {
  ensureListener();
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.ReactNativeWebView) {
      reject(new Error('native bridge unavailable'));
      return;
    }
    const id = uuid();
    const req: BridgeRequest = { id, type, payload };
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`bridge timeout: ${type}`));
    }, REQUEST_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    window.ReactNativeWebView.postMessage(JSON.stringify(req));
  });
}

// ---- Public capability API ----

export interface Bridge {
  isNative: boolean;
  capturePhoto(): Promise<CameraCaptureResult>;
  getLocation(): Promise<LocationResult>;
  getPushToken(): Promise<PushTokenResult | null>;
  secureSet(key: string, value: string): Promise<void>;
  secureGet(key: string): Promise<string | null>;
  secureDelete(key: string): Promise<void>;
  haptic(style?: 'light' | 'medium' | 'heavy'): void;
}

// ---- Browser fallbacks ----

const SECURE_PREFIX = 'orgk.secure.';

function browserGetLocation(): Promise<LocationResult> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('geolocation unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? 9999,
          is_mock: false, // browsers cannot report mock-location
          timestamp: new Date(pos.timestamp).toISOString(),
        }),
      (err) => reject(new Error(err.message || 'location denied')),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  });
}

// Live camera capture in a plain browser via a hidden <input capture>.
function browserCapturePhoto(): Promise<CameraCaptureResult> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment'); // live capture, rear camera
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    const cleanup = () => input.remove();
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        cleanup();
        reject(new Error('no photo captured'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        cleanup();
        resolve({ dataUrl: String(reader.result) });
      };
      reader.onerror = () => {
        cleanup();
        reject(new Error('failed to read photo'));
      };
      reader.readAsDataURL(file);
    });
    // If the user cancels there is no reliable event; rely on the timeout that
    // the caller (capture flows) imposes by leaving the promise pending until a
    // new capture is attempted. To avoid a leak we add a window focus fallback.
    const onFocus = () => {
      setTimeout(() => {
        if (!input.files?.length) {
          window.removeEventListener('focus', onFocus);
          cleanup();
          reject(new Error('capture cancelled'));
        }
      }, 800);
    };
    window.addEventListener('focus', onFocus, { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

export const bridge: Bridge = {
  get isNative() {
    return hasNativeBridge();
  },

  async capturePhoto() {
    const client = nativeClient();
    if (client) return adaptCamera(await client.capturePhoto({}));
    if (window.ReactNativeWebView)
      return adaptCamera((await callRaw('camera.capture', {})) as CameraCaptureData);
    return browserCapturePhoto();
  },

  async getLocation() {
    const client = nativeClient();
    if (client) return adaptLocation(await client.getLocation({}));
    if (window.ReactNativeWebView)
      return adaptLocation((await callRaw('location.get', {})) as LocationData);
    return browserGetLocation();
  },

  async getPushToken() {
    const client = nativeClient();
    try {
      if (client) {
        const r = await client.registerForPush();
        if (!r?.token) return null;
        return { token: r.token, platform: 'android' };
      }
      if (window.ReactNativeWebView) {
        const r = (await callRaw('push.register')) as {
          token: string | null;
        } | null;
        if (!r?.token) return null;
        return { token: r.token, platform: 'android' };
      }
    } catch {
      return null;
    }
    return null; // no push in plain browser
  },

  async secureSet(key, value) {
    const client = nativeClient();
    if (client) {
      await client.secureStore.set(key, value);
      return;
    }
    if (window.ReactNativeWebView) {
      await callRaw('secureStore.set', { key, value });
      return;
    }
    try {
      localStorage.setItem(SECURE_PREFIX + key, value);
    } catch {
      /* private mode — ignore */
    }
  },

  async secureGet(key) {
    const client = nativeClient();
    if (client) {
      const r = await client.secureStore.get(key);
      return r?.value ?? null;
    }
    if (window.ReactNativeWebView) {
      const r = (await callRaw('secureStore.get', { key })) as {
        value: string | null;
      } | null;
      return r?.value ?? null;
    }
    try {
      return localStorage.getItem(SECURE_PREFIX + key);
    } catch {
      return null;
    }
  },

  async secureDelete(key) {
    const client = nativeClient();
    if (client) {
      await client.secureStore.delete(key);
      return;
    }
    if (window.ReactNativeWebView) {
      await callRaw('secureStore.delete', { key });
      return;
    }
    try {
      localStorage.removeItem(SECURE_PREFIX + key);
    } catch {
      /* ignore */
    }
  },

  // The canonical bridge protocol has no `haptic` request type, so we only
  // provide the browser Vibration nicety; on native this is a silent no-op.
  haptic(style = 'light') {
    if (hasNativeBridge()) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(style === 'heavy' ? 30 : style === 'medium' ? 18 : 10);
    }
  },
};
