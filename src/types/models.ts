// Domain models — mirror CONTRACT §3 (the field surface subset).

import type {
  CreditResult,
  OrderStatus,
  OutletClass,
  OutletStatus,
  PaymentMethod,
  PaymentType,
  ReasonCode,
  ReceivableStatus,
  Role,
  VisitOutcome,
} from './enums';

// GeoJSON Point — lng first (CONTRACT §1).
export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

export interface User {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  territory_ids: string[];
  manager_id?: string | null;
  status: 'active' | 'disabled';
  created_at: string;
  updated_at: string;
}

export interface TenantConfig {
  geofence_radius_m: number; // default 100
  gps_accuracy_threshold_m: number; // default 50
  credit_policy: {
    over_limit: 'warn' | 'block' | 'require_approval';
    overdue: 'warn' | 'block' | 'require_approval';
  };
  reason_codes: ReasonCode[];
  outlet_custom_fields: OutletCustomField[];
  dormant_days: number; // default 45
  // Credit ceiling applied to field-added (new) outlets. Surfaced on the
  // payment screen so the rep isn't surprised by a server-side rejection.
  new_outlet_credit_limit: number; // default 5000
}

export interface OutletCustomField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  required?: boolean;
  options?: string[];
}

export interface OutletProfile {
  shop_type?: string;
  owner_name?: string;
  owner_phone?: string;
  gst?: string;
  pan?: string;
  refrigeration?: boolean;
  shelf_space?: string;
  competitor_brands?: string;
  est_monthly_volume?: number;
  preferred_order_day?: string;
  // custom fields by key
  [custom: string]: unknown;
}

export interface Outlet {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  location: GeoPoint;
  geofence_radius_m?: number | null;
  photos: string[];
  profile: OutletProfile;
  outlet_class: OutletClass;
  status: OutletStatus;
  credit_limit: number;
  outstanding: number;
  assigned_rep_id?: string | null;
  territory_id?: string | null;
  created_by?: string | null;
  approved_by?: string | null;
  last_order_at?: string | null;
  last_visit_at?: string | null;
  next_visit_date?: string | null;
  client_uuid?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CheckInRecord {
  location: GeoPoint;
  accuracy: number;
  timestamp: string;
  photo_url?: string | null;
  in_fence: boolean;
  distance_m: number;
  is_mock: boolean;
  flag_reason?: string | null;
}

export interface CheckOutRecord {
  // null when the checkout GPS read failed/was denied (server still computes
  // duration from check-in → check-out timestamps). Mirrors backend CheckOut.
  location: GeoPoint | null;
  timestamp: string;
}

export interface VisitPitch {
  demoed_sku_ids: string[];
  notes?: string;
  photos: string[];
}

export interface Visit {
  id: string;
  tenant_id: string;
  outlet_id: string;
  rep_id: string;
  route_id?: string | null;
  check_in?: CheckInRecord | null;
  check_out?: CheckOutRecord | null;
  duration_min?: number | null;
  outcome?: VisitOutcome | null;
  reason_code?: ReasonCode | null;
  order_id?: string | null;
  pitch?: VisitPitch | null;
  next_visit_date?: string | null;
  client_uuid?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Sku {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  category: string;
  pack_size: string;
  unit: string;
  mrp: number;
  ptr: number; // price-to-retailer — the field order price
  ptd: number;
  moq: number;
  hsn: string;
  gst_rate: number;
  image_url?: string | null;
  active: boolean;
}

// Stock-aware catalog entry (GET /skus/catalog).
export interface CatalogItem extends Sku {
  qty_available: number;
  warehouse_id?: string | null;
  orderable: boolean; // false when out of stock
}

export interface OrderLineItem {
  sku_id: string;
  sku_name: string;
  qty: number;
  unit_price: number;
  discount_pct: number;
  discount_amt: number;
  line_total: number;
  gst_rate: number;
  gst_amt: number;
}

export interface CreditCheck {
  limit: number;
  outstanding: number;
  order_value: number;
  result: CreditResult;
  overridden_by?: string | null;
}

export interface OrderStatusHistoryEntry {
  status: OrderStatus;
  at: string;
  by: string;
  note?: string;
}

export interface Order {
  id: string;
  tenant_id: string;
  code: string;
  outlet_id: string;
  rep_id: string;
  visit_id?: string | null;
  warehouse_id?: string | null;
  line_items: OrderLineItem[];
  subtotal: number;
  discount_total: number;
  gst_total: number;
  total: number;
  status: OrderStatus;
  credit_check?: CreditCheck | null;
  status_history: OrderStatusHistoryEntry[];
  expected_delivery_date?: string | null;
  client_uuid?: string | null;
  idempotency_key?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentCollection {
  amount: number;
  method: PaymentMethod;
  reference?: string;
  at: string;
  by: string;
}

export interface Payment {
  id: string;
  tenant_id: string;
  order_id: string;
  outlet_id: string;
  type: PaymentType;
  method: PaymentMethod;
  amount_collected: number;
  balance: number;
  credit_days: number;
  due_date?: string | null;
  reference?: string;
  collected_by: string;
  status: ReceivableStatus;
  collections: PaymentCollection[];
  client_uuid?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RouteDoc {
  id: string;
  tenant_id: string;
  name: string;
  rep_id: string;
  asm_id?: string | null;
  territory_id?: string | null;
  outlet_ids: string[];
  day_of_week?: number;
  cycle?: string;
  active: boolean;
}

// GET /routes/today — ordered outlets for the rep today.
export interface TodayRoute {
  route: RouteDoc | null;
  outlets: Outlet[];
}

// Deep-link payload carried by a notification (and by the shell's `push.opened`
// event). All keys optional; the app routes to the most specific target
// available (route → outlet → order → today). The index signature tolerates
// extra keys the backend may add (e.g. `type`).
export interface NotificationData {
  route?: string; // explicit in-app path, e.g. "/orders/abc"
  outlet_id?: string;
  order_id?: string;
  visit_id?: string;
  [k: string]: unknown;
}

export interface AppNotification {
  id: string;
  // Present on some backends; optional so the pinned contract shape
  // ({ id, type, title, body, data, read, created_at }) validates as-is.
  tenant_id?: string;
  user_id?: string;
  type: string;
  title: string;
  body: string;
  data?: NotificationData;
  read: boolean;
  created_at: string;
}
