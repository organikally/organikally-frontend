// API request/response payload shapes — mirror CONTRACT §4 & §7.

import type {
  CatalogItem,
  GeoPoint,
  Order,
  Outlet,
  OutletProfile,
  Payment,
  Sku,
  TenantConfig,
  User,
  Visit,
} from './models';
import type {
  PaymentMethod,
  PaymentType,
  ReasonCode,
  VisitOutcome,
} from './enums';

// List envelope (CONTRACT §1).
export interface ListEnvelope<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// Auth
export interface LoginRequest {
  email: string;
  password: string;
}
export interface LoginResponse {
  access_token: string;
  token_type: 'bearer';
  user: User;
}

// Outlet onboarding (field) — POST /outlets
export interface OutletCreateRequest {
  name: string;
  location: GeoPoint;
  photos: string[];
  profile: OutletProfile;
  outlet_class?: string;
  territory_id?: string | null;
  client_uuid: string;
}

// Visit check-in — POST /visits/check-in
export interface CheckInRequest {
  outlet_id: string;
  location: GeoPoint;
  accuracy: number;
  photo_url?: string | null;
  is_mock: boolean;
  flag_reason?: string | null;
  route_id?: string | null;
  client_uuid: string;
}

// Visit check-out — POST /visits/{id}/check-out (online) or the
// `visit.check_out` sync mutation (offline). The server resolves the visit by
// its check-in `visit_client_uuid` (offline) and computes `duration_min` from
// check-in → check-out timestamps. `location` may be null if the GPS read
// failed at checkout.
export interface CheckOutRequest {
  location: GeoPoint | null;
  timestamp?: string;
  // Reference the offline-created visit by its check-in client_uuid; the server
  // resolves the real visit id during batch replay (check-in precedes this).
  visit_client_uuid?: string;
}

export interface PitchRequest {
  demoed_sku_ids: string[];
  notes?: string;
  photos: string[];
}

export interface OutcomeRequest {
  outcome: VisitOutcome;
  reason_code?: ReasonCode | null;
  next_visit_date?: string | null;
  // Server order id when known (online); offline we instead pass
  // `order_client_uuid` so the server resolves the order created in the same
  // batch. Never send a synthesized client-prefixed string in `order_id`.
  order_id?: string | null;
  order_client_uuid?: string | null;
  // Pitch/demo log folded into the outcome so it isn't lost offline — the sync
  // protocol (§4) has no standalone `visit.pitch` mutation type.
  pitch?: PitchRequest | null;
}

// Orders — POST /orders
export interface OrderLineInput {
  sku_id: string;
  qty: number;
  discount_pct?: number;
}
export interface OrderCreateRequest {
  outlet_id: string;
  visit_id?: string | null;
  warehouse_id?: string | null;
  line_items: OrderLineInput[];
  expected_delivery_date?: string | null;
  client_uuid: string;
  idempotency_key: string;
}

// Payments — POST /payments
export interface PaymentCreateRequest {
  // Server order id when known (online). Offline we leave this null and pass
  // `order_client_uuid` so the server resolves the order created in the same
  // batch replay.
  order_id?: string | null;
  order_client_uuid?: string | null;
  type: PaymentType;
  method: PaymentMethod;
  amount_collected: number;
  credit_days?: number;
  reference?: string;
  client_uuid: string;
}

// Sync bootstrap — GET /sync/bootstrap
// `route_today` is the route doc (with ordered `outlet_ids`); the outlets
// themselves are in the top-level `outlets` array.
export interface SyncBootstrap {
  outlets: Outlet[];
  route_today: { outlet_ids?: string[]; outlets?: Outlet[] } | null;
  catalog: CatalogItem[];
  warehouse_id?: string | null;
  config: TenantConfig;
  server_time: string;
}

// Sync batch — POST /sync/batch
export type MutationType =
  | 'outlet.create'
  | 'visit.check_in'
  | 'visit.check_out'
  | 'visit.outcome'
  | 'order.create'
  | 'payment.create';

export interface SyncMutation {
  client_uuid: string;
  type: MutationType;
  payload: unknown;
  idempotency_key: string;
  created_at: string;
}

export interface SyncResult {
  client_uuid: string;
  status: 'ok' | 'duplicate' | 'error';
  server_id?: string;
  error?: string;
}

export interface SyncBatchResponse {
  results: SyncResult[];
}

// Media upload — POST /media/upload
export type MediaKind = 'outlet' | 'visit' | 'pitch';
export interface MediaUploadResponse {
  url: string;
}

// Re-export commonly used response aliases for ergonomic imports.
export type {
  CatalogItem,
  Order,
  Outlet,
  Payment,
  Sku,
  TenantConfig,
  User,
  Visit,
};
