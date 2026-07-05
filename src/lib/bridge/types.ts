// Typed message protocol between the field web app and the Expo WebView shell.
//
// CANONICAL SOURCE OF TRUTH: organikally-app/src/bridge/protocol.ts + BRIDGE.md.
// These types MUST mirror it exactly. The shell injects a ready-made client onto
// `window.OrganikalyBridge` before the field app loads, and the field app calls
// that client (it does not implement the raw transport itself). Raw transport is
// modelled here only for the legacy fallback path.
//
//   web -> shell : window.ReactNativeWebView.postMessage(JSON.stringify(request))
//   shell -> web : shell calls window.__organikalyDeliver(jsonString)
//
// Every request carries a unique `id`. Every response echoes that `id` and is
// EITHER a success (`ok:true` + `data`) OR a failure (`ok:false` + `error`).

// ---- Request types (exact strings the shell dispatches on) ----
export type BridgeRequestType =
  | 'ping'
  | 'camera.capture' // live capture only — no gallery
  | 'location.get' // precise GPS + accuracy + mock flag
  | 'permissions.status'
  | 'push.register' // device push token (Expo)
  | 'secureStore.get'
  | 'secureStore.set'
  | 'secureStore.delete'
  | 'app.reload'
  | 'app.openSettings';

export interface BridgeRequest {
  id: string; // correlation id (UUID), echoed in the response
  type: BridgeRequestType;
  payload?: unknown;
}

// ---- Response envelope (matches protocol.ts BridgeResponse) ----
export type BridgeErrorCode =
  | 'PERMISSION_DENIED'
  | 'PERMISSION_DENIED_NEVER_ASK'
  | 'USER_CANCELLED'
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'INVALID_REQUEST'
  | 'UNKNOWN_TYPE'
  | 'INTERNAL';

export interface BridgeError {
  code: BridgeErrorCode;
  message: string;
}

export interface BridgeResponseOk {
  id: string;
  ok: true;
  data: unknown;
}
export interface BridgeResponseError {
  id: string;
  ok: false;
  error: BridgeError;
}
export type BridgeResponse = BridgeResponseOk | BridgeResponseError;

// Unsolicited shell -> web event (no `id`).
export interface BridgeEvent<D = unknown> {
  event: 'push.received' | 'push.opened' | 'app.backPressed' | 'app.state';
  data: D;
}

// ---- Canonical response DATA shapes (subset the field app consumes) ----

// location.get — note: canonical uses `isMock` (camelCase).
export interface LocationData {
  lat: number;
  lng: number;
  accuracy: number; // metres
  timestamp: string; // ISO-8601 UTC
  isMock: boolean; // device-reported mock-location flag
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
}

// camera.capture — canonical returns a file URI + optional base64 (no `dataUrl`).
export interface CameraCaptureData {
  uri: string;
  width: number;
  height: number;
  base64?: string; // raw base64, no data: prefix
  size?: number;
  mimeType: 'image/jpeg';
  liveCapture: true;
  capturedAt: string;
  kind?: 'outlet' | 'visit' | 'pitch';
}

// push.register
export interface PushRegisterData {
  token: string | null;
  type: 'expo';
  granted: boolean;
}

export interface SecureStoreGetData {
  value: string | null;
}

// ---- Field-app internal result shapes (adapter outputs the UI consumes) ----

// Live photo: the field UI works in data URLs; we expose `dataUrl`/`fileUri` and
// adapt the canonical `{uri,base64}` into them.
export interface CameraCaptureResult {
  dataUrl?: string;
  fileUri?: string;
  width?: number;
  height?: number;
}

// GPS reading consumed by geo.ts / GpsReader — uses snake_case `is_mock` to
// match the check-in payload field (CONTRACT §4 Visits).
export interface LocationResult {
  lat: number;
  lng: number;
  accuracy: number; // metres
  is_mock: boolean; // device-reported mock-location flag
  timestamp: string; // ISO-8601
}

export interface PushTokenResult {
  token: string;
  platform: 'ios' | 'android' | 'web';
}

export interface SecureStoreGetResult {
  value: string | null;
}

// ---- Canonical injected client (window.OrganikalyBridge) ----
// Shape of the client the Expo shell installs; the field app calls it directly.
export interface OrganikalyNativeBridge {
  isNative: true;
  version: number;
  AUTH_TOKEN_KEY: string;
  ping(): Promise<unknown>;
  capturePhoto(opts?: {
    kind?: 'outlet' | 'visit' | 'pitch';
    quality?: number;
    base64?: boolean;
    facing?: 'back' | 'front';
  }): Promise<CameraCaptureData>;
  getLocation(opts?: {
    maxAccuracyM?: number;
    timeoutMs?: number;
  }): Promise<LocationData>;
  permissionsStatus(): Promise<unknown>;
  registerForPush(): Promise<PushRegisterData>;
  secureStore: {
    get(key: string): Promise<SecureStoreGetData>;
    set(key: string, value: string): Promise<{ saved: true }>;
    delete(key: string): Promise<{ deleted: true }>;
  };
  reload(): Promise<unknown>;
  openSettings(): Promise<unknown>;
  on(event: string, handler: (data: unknown) => void): () => void;
}

// SecureStore key the field app uses for the auth JWT — must match the canonical
// protocol constant (`organikaly.auth.token`, exported by protocol.ts).
export const AUTH_TOKEN_KEY = 'organikaly.auth.token' as const;

// Augment the global Window with both the canonical injected client and the raw
// React Native WebView handle (legacy fallback transport).
declare global {
  interface Window {
    OrganikalyBridge?: OrganikalyNativeBridge;
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
    // Low-level delivery hook the shell calls to push responses/events in.
    __organikalyDeliver?: (json: string) => void;
  }
}
