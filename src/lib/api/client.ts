// Typed REST client for the Organikaly backend (CONTRACT §1 & §4).
//
// - Bearer auth from the session store.
// - List endpoints return the { items,total,page,page_size } envelope.
// - Single resources return the bare object.
// - Errors surface { detail } as ApiError with the HTTP status.

import type {
  CheckInRequest,
  CheckOutRequest,
  DedupeQuery,
  DedupeResponse,
  ListEnvelope,
  LoginRequest,
  LoginResponse,
  MediaKind,
  MediaUploadResponse,
  NotificationListResponse,
  NotificationsQuery,
  OrderCreateRequest,
  OutcomeRequest,
  OutletCreateRequest,
  PaymentCreateRequest,
  PitchRequest,
  SyncBatchResponse,
  SyncBootstrap,
  SyncMutation,
} from '@/types/api';
import type {
  CatalogItem,
  Order,
  Outlet,
  Payment,
  Sku,
  TenantConfig,
  User,
  Visit,
} from '@/types/models';

export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  'http://localhost:8000/api/v1';

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

// Token plumbing — set by the session store on login/restore.
let authToken: string | null = null;
export function setAuthToken(token: string | null): void {
  authToken = token;
}
export function getAuthToken(): string | null {
  return authToken;
}

interface RequestOpts {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  // When the body is FormData (media upload) we skip JSON encoding.
  form?: FormData;
}

function buildUrl(
  path: string,
  query?: RequestOpts['query'],
): string {
  const url = new URL(
    API_BASE.replace(/\/$/, '') + (path.startsWith('/') ? path : `/${path}`),
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
  );
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v));
      }
    }
  }
  return url.toString();
}

export async function request<T>(
  path: string,
  opts: RequestOpts = {},
): Promise<T> {
  const headers: Record<string, string> = { ...opts.headers };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form; // browser sets multipart boundary
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? (opts.body || opts.form ? 'POST' : 'GET'),
      headers,
      body,
      signal: opts.signal,
    });
  } catch (e) {
    // Network failure — distinguish from HTTP errors for the offline layer.
    throw new ApiError(0, (e as Error).message || 'network error');
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const detail =
      (data as { detail?: unknown })?.detail ?? data ?? res.statusText;
    const message =
      typeof detail === 'string' ? detail : `Request failed (${res.status})`;
    throw new ApiError(res.status, message, detail);
  }

  return data as T;
}

// Idempotency-Key header helper.
function idem(key?: string): Record<string, string> {
  return key ? { 'Idempotency-Key': key } : {};
}

export const api = {
  // ---- Auth ----
  login(body: LoginRequest) {
    return request<LoginResponse>('/auth/login', { body });
  },
  me() {
    return request<User>('/auth/me');
  },
  registerPushToken(token: string, platform: string) {
    return request<void>('/auth/push-token', { body: { token, platform } });
  },
  logout() {
    return request<void>('/auth/logout', { method: 'POST' });
  },

  // ---- Routes ----
  // The backend returns the route doc + an ordered list of outlet ids; the
  // caller hydrates the outlets from cache/list (CONTRACT §4 routes/today).
  routesToday() {
    return request<{
      route: unknown;
      outlet_ids: string[];
      day_of_week?: number;
    }>('/routes/today');
  },

  // ---- Outlets ----
  listOutlets(query?: {
    status?: string;
    q?: string;
    assigned_rep?: string;
    territory?: string;
    near?: string;
    radius?: number;
    page?: number;
    page_size?: number;
  }) {
    return request<ListEnvelope<Outlet>>('/outlets', { query });
  },
  getOutlet(id: string) {
    return request<Outlet>(`/outlets/${id}`);
  },
  createOutlet(body: OutletCreateRequest) {
    return request<Outlet>('/outlets', {
      body,
      headers: idem(body.client_uuid),
    });
  },
  outletVisits(id: string) {
    return request<ListEnvelope<Visit>>(`/outlets/${id}/visits`);
  },
  // Pre-create de-dupe: warn about a shop that may already exist by proximity,
  // phone, gstin or name. `near` is "lng,lat". Returns { items, total } where
  // each item is an Outlet + { distance_m, match }.
  dedupeOutlets(query: DedupeQuery) {
    return request<DedupeResponse>('/outlets/dedupe', {
      query: {
        near: query.near,
        phone: query.phone,
        gstin: query.gstin,
        name: query.name,
      },
    });
  },

  // ---- Visits ----
  checkIn(body: CheckInRequest) {
    return request<Visit>('/visits/check-in', {
      body,
      headers: idem(body.client_uuid),
    });
  },
  checkOut(visitId: string, body: CheckOutRequest) {
    return request<Visit>(`/visits/${visitId}/check-out`, { body });
  },
  pitch(visitId: string, body: PitchRequest) {
    return request<Visit>(`/visits/${visitId}/pitch`, { body });
  },
  outcome(visitId: string, body: OutcomeRequest) {
    return request<Visit>(`/visits/${visitId}/outcome`, { body });
  },
  listVisits(query?: { rep_id?: string; date?: string; outlet_id?: string }) {
    return request<ListEnvelope<Visit>>('/visits', { query });
  },
  getVisit(id: string) {
    return request<Visit>(`/visits/${id}`);
  },

  // ---- Catalog / SKU ----
  // The stock-aware catalog is returned as a list envelope (CONTRACT §1):
  // { items, total, warehouse_id }.
  catalog(query?: { warehouse_id?: string; category?: string }) {
    return request<{
      items: CatalogItem[];
      total: number;
      warehouse_id?: string | null;
    }>('/skus/catalog', { query });
  },
  listSkus(query?: { q?: string; category?: string; active?: boolean }) {
    return request<ListEnvelope<Sku>>('/skus', { query });
  },

  // ---- Orders ----
  createOrder(body: OrderCreateRequest) {
    return request<Order>('/orders', {
      body,
      headers: idem(body.idempotency_key),
    });
  },
  listOrders(query?: {
    status?: string;
    rep?: string;
    outlet?: string;
    from?: string;
    to?: string;
  }) {
    return request<ListEnvelope<Order>>('/orders', { query });
  },
  getOrder(id: string) {
    return request<Order>(`/orders/${id}`);
  },

  // ---- Payments ----
  createPayment(body: PaymentCreateRequest) {
    return request<Payment>('/payments', {
      body,
      headers: idem(body.client_uuid),
    });
  },
  listPayments(query?: { outlet_id?: string; status?: string }) {
    return request<ListEnvelope<Payment>>('/payments', { query });
  },

  // ---- Config / notifications ----
  config() {
    return request<TenantConfig>('/config');
  },
  // Returns { items, unread_count }. Callers should tolerate a 404 (backend not
  // yet shipped) — see features/notifications/data.ts, which degrades to empty.
  notifications(query?: NotificationsQuery) {
    return request<NotificationListResponse>('/notifications', {
      query: {
        unread_only: query?.unread_only,
        limit: query?.limit,
      },
    });
  },
  markNotificationRead(id: string) {
    return request<void>(`/notifications/${id}/read`, { method: 'POST' });
  },
  markAllNotificationsRead() {
    return request<void>('/notifications/read-all', { method: 'POST' });
  },

  // ---- Sync ----
  bootstrap(since?: string) {
    return request<SyncBootstrap>('/sync/bootstrap', {
      query: since ? { since } : undefined,
    });
  },
  syncBatch(mutations: SyncMutation[]) {
    return request<SyncBatchResponse>('/sync/batch', { body: { mutations } });
  },

  // ---- Media ----
  async uploadMedia(blob: Blob, kind: MediaKind): Promise<MediaUploadResponse> {
    const form = new FormData();
    form.append('kind', kind);
    form.append(
      'file',
      blob,
      `${kind}-${Date.now()}.jpg`,
    );
    return request<MediaUploadResponse>('/media/upload', { form });
  },
};
