// High-level offline-mutation helpers used by the feature flows.
//
// Each helper: (1) optionally queues live photo blobs, (2) writes a queued
// mutation with client_uuid + idempotency_key, (3) optimistically updates the
// local IndexedDB cache so screens render immediately offline, then (4) kicks
// the sync engine. The returned client_uuid links the optimistic entity.

import { v4 as uuid } from 'uuid';
import type {
  CheckInRequest,
  CheckOutRequest,
  OrderCreateRequest,
  OutcomeRequest,
  OutletCreateRequest,
  PaymentCreateRequest,
} from '@/types/api';
import type {
  CatalogItem,
  Order,
  Outlet,
  Payment,
  Visit,
} from '@/types/models';
import {
  enqueueMutation,
  enqueuePhoto,
  getVisit,
  putOrder,
  putOutlet,
  putPayment,
  putVisit,
  type QueuedPhoto,
} from './db';
import { PHOTO_TOKEN_PREFIX, syncEngine } from './sync';

function nowIso(): string {
  return new Date().toISOString();
}

// Queue a captured photo blob; returns a `photo://<id>` token to embed in
// payloads. The sync engine uploads the blob then swaps the token for the URL.
export async function queuePhoto(
  blob: Blob,
  kind: QueuedPhoto['kind'],
): Promise<string> {
  const id = uuid();
  await enqueuePhoto({
    id,
    kind,
    blob,
    created_at: nowIso(),
    status: 'pending',
    attempts: 0,
  });
  return `${PHOTO_TOKEN_PREFIX}${id}`;
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

// ---- Outlet onboarding ----
export async function enqueueOutletCreate(
  body: OutletCreateRequest,
  optimistic: Partial<Outlet> & { name: string },
): Promise<string> {
  const client_uuid = body.client_uuid;
  await enqueueMutation({
    client_uuid,
    type: 'outlet.create',
    payload: body,
    idempotency_key: client_uuid,
    created_at: nowIso(),
    entity: 'outlet',
    label: `Onboard ${body.name}`,
  });
  // Optimistic local outlet so it appears in lists/route immediately.
  const local: Outlet = {
    id: `local:${client_uuid}`,
    tenant_id: 'organikaly',
    name: optimistic.name,
    code: optimistic.code ?? 'PENDING',
    location: body.location,
    geofence_radius_m: null,
    photos: [],
    profile: body.profile,
    outlet_class: (optimistic.outlet_class as Outlet['outlet_class']) ?? 'C',
    status: 'pending_approval',
    credit_limit: 0,
    outstanding: 0,
    assigned_rep_id: optimistic.assigned_rep_id ?? null,
    territory_id: body.territory_id ?? null,
    created_by: optimistic.created_by ?? null,
    approved_by: null,
    last_order_at: null,
    last_visit_at: null,
    next_visit_date: null,
    client_uuid,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await putOutlet(local);
  void syncEngine.sync();
  return client_uuid;
}

// ---- Visit check-in ----
export async function enqueueCheckIn(
  body: CheckInRequest,
  optimistic: { outlet_id: string; rep_id: string },
): Promise<string> {
  const client_uuid = body.client_uuid;
  await enqueueMutation({
    client_uuid,
    type: 'visit.check_in',
    payload: body,
    idempotency_key: client_uuid,
    created_at: nowIso(),
    entity: 'visit',
    label: 'Check-in',
  });
  const local: Visit = {
    id: `local:${client_uuid}`,
    tenant_id: 'organikaly',
    outlet_id: optimistic.outlet_id,
    rep_id: optimistic.rep_id,
    route_id: body.route_id ?? null,
    check_in: {
      location: body.location,
      accuracy: body.accuracy,
      timestamp: nowIso(),
      photo_url: null,
      in_fence: !body.flag_reason,
      distance_m: 0,
      is_mock: body.is_mock,
      flag_reason: body.flag_reason ?? null,
    },
    check_out: null,
    duration_min: null,
    outcome: null,
    reason_code: null,
    order_id: null,
    pitch: null,
    next_visit_date: null,
    client_uuid,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await putVisit(local);
  void syncEngine.sync();
  return client_uuid;
}

// ---- Visit check-out ----
// Enqueues a `visit.check_out` mutation referencing the offline-created visit by
// its check-in client_uuid. The server resolves the visit and computes
// `duration_min` (CONTRACT §3, §5.7, §7). Optimistically stamps the local visit
// so the Today/history screens reflect the closed visit offline.
export async function enqueueCheckOut(
  visitClientUuid: string,
  body: CheckOutRequest,
): Promise<void> {
  const client_uuid = uuid();
  const ts = body.timestamp ?? nowIso();
  await enqueueMutation({
    client_uuid,
    type: 'visit.check_out',
    payload: {
      visit_client_uuid: visitClientUuid,
      location: body.location,
      timestamp: ts,
    },
    idempotency_key: client_uuid,
    created_at: nowIso(),
    entity: 'visit',
    label: 'Check-out',
  });
  // Optimistically close the local visit (keyed by check-in client_uuid).
  const local = await getVisit(`local:${visitClientUuid}`);
  if (local) {
    const durationMin = local.check_in
      ? Math.round(
          ((new Date(ts).getTime() -
            new Date(local.check_in.timestamp).getTime()) /
            60000) *
            10,
        ) / 10
      : null;
    await putVisit({
      ...local,
      check_out: { location: body.location, timestamp: ts },
      duration_min: durationMin,
      updated_at: nowIso(),
    });
  }
  void syncEngine.sync();
}

// ---- Visit outcome (final checkout) ----
export async function enqueueOutcome(
  visitClientUuid: string,
  body: OutcomeRequest,
): Promise<void> {
  const client_uuid = uuid();
  await enqueueMutation({
    client_uuid,
    type: 'visit.outcome',
    // Reference the visit by its client_uuid; the server resolves the real id.
    payload: { visit_client_uuid: visitClientUuid, ...body },
    idempotency_key: client_uuid,
    created_at: nowIso(),
    entity: 'visit',
    label: `Outcome: ${body.outcome}`,
  });
  void syncEngine.sync();
}

// ---- Order create ----
export async function enqueueOrderCreate(
  body: OrderCreateRequest,
  optimistic: { items: CatalogItem[]; qtyById: Record<string, number> },
): Promise<string> {
  const client_uuid = body.client_uuid;
  await enqueueMutation({
    client_uuid,
    type: 'order.create',
    payload: body,
    idempotency_key: body.idempotency_key,
    created_at: nowIso(),
    entity: 'order',
    label: 'Order',
  });
  // Optimistic order from local pricing (server is authoritative on replay).
  let subtotal = 0;
  let gst_total = 0;
  let discount_total = 0;
  const line_items = body.line_items.map((li) => {
    const sku = optimistic.items.find((s) => s.id === li.sku_id)!;
    const qty = optimistic.qtyById[li.sku_id] ?? li.qty;
    const gross = sku.ptr * qty;
    const discount_amt = (gross * (li.discount_pct ?? 0)) / 100;
    const net = gross - discount_amt;
    const gst_amt = (net * sku.gst_rate) / 100;
    subtotal += gross;
    discount_total += discount_amt;
    gst_total += gst_amt;
    return {
      sku_id: sku.id,
      sku_name: sku.name,
      qty,
      unit_price: sku.ptr,
      discount_pct: li.discount_pct ?? 0,
      discount_amt,
      line_total: net + gst_amt,
      gst_rate: sku.gst_rate,
      gst_amt,
    };
  });
  const total = subtotal - discount_total + gst_total;
  const local: Order = {
    id: `local:${client_uuid}`,
    tenant_id: 'organikaly',
    code: 'PENDING',
    outlet_id: body.outlet_id,
    rep_id: '',
    visit_id: body.visit_id ?? null,
    warehouse_id: body.warehouse_id ?? null,
    line_items,
    subtotal,
    discount_total,
    gst_total,
    total,
    status: 'draft',
    credit_check: null,
    status_history: [{ status: 'draft', at: nowIso(), by: 'rep' }],
    expected_delivery_date: body.expected_delivery_date ?? null,
    client_uuid,
    idempotency_key: body.idempotency_key,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await putOrder(local);
  void syncEngine.sync();
  return client_uuid;
}

// ---- Payment ----
export async function enqueuePayment(
  body: PaymentCreateRequest,
  optimistic: { outlet_id: string },
): Promise<string> {
  const client_uuid = body.client_uuid;
  await enqueueMutation({
    client_uuid,
    type: 'payment.create',
    payload: body,
    idempotency_key: client_uuid,
    created_at: nowIso(),
    entity: 'payment',
    label: `Payment ₹${body.amount_collected}`,
  });
  const balance = 0;
  const local: Payment = {
    id: `local:${client_uuid}`,
    tenant_id: 'organikaly',
    order_id: body.order_id ?? `local:${body.order_client_uuid ?? client_uuid}`,
    outlet_id: optimistic.outlet_id,
    type: body.type,
    method: body.method,
    amount_collected: body.amount_collected,
    balance,
    credit_days: body.credit_days ?? 0,
    due_date: null,
    reference: body.reference,
    collected_by: '',
    status: body.type === 'full' ? 'paid' : 'open',
    collections: [],
    client_uuid,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await putPayment(local);
  void syncEngine.sync();
  return client_uuid;
}

export function newClientUuid(): string {
  return uuid();
}
