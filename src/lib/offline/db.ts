// IndexedDB schema + helpers (via idb). Holds:
//  - outbound mutation queue (CONTRACT §7.2)
//  - queued photo blobs for deferred upload (CONTRACT §7.4)
//  - cached reference data from /sync/bootstrap for offline use (CONTRACT §7.1)
//  - cached created/visited entities so screens render offline
//
// Mirrors the offline contract: every mutation carries client_uuid +
// idempotency_key and replays idempotently via /sync/batch.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { MutationType } from '@/types/api';
import type {
  CatalogItem,
  Order,
  Outlet,
  Payment,
  TenantConfig,
  Visit,
} from '@/types/models';

export type QueueStatus = 'pending' | 'syncing' | 'synced' | 'duplicate' | 'error';

export interface QueuedMutation {
  client_uuid: string; // primary key
  type: MutationType;
  payload: unknown;
  idempotency_key: string;
  created_at: string;
  status: QueueStatus;
  attempts: number;
  next_attempt_at: number; // epoch ms for backoff scheduling
  last_error?: string;
  server_id?: string;
  // For local optimistic linkage (e.g. order -> visit) and UI grouping.
  entity?: string;
  label?: string;
}

export interface QueuedPhoto {
  id: string; // primary key (UUID)
  kind: 'outlet' | 'visit' | 'pitch';
  blob: Blob;
  created_at: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  url?: string; // server url after upload
  attempts: number;
  last_error?: string;
}

export interface KVRecord {
  key: string;
  value: unknown;
  updated_at: string;
}

interface OrgkDB extends DBSchema {
  mutations: {
    key: string;
    value: QueuedMutation;
    indexes: { by_status: QueueStatus; by_created: string };
  };
  photos: {
    key: string;
    value: QueuedPhoto;
    indexes: { by_status: string };
  };
  outlets: {
    key: string;
    value: Outlet;
    indexes: { by_status: string };
  };
  catalog: { key: string; value: CatalogItem };
  visits: {
    key: string;
    value: Visit;
    indexes: { by_outlet: string };
  };
  orders: { key: string; value: Order };
  payments: { key: string; value: Payment };
  kv: { key: string; value: KVRecord };
}

const DB_NAME = 'organikally-field';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<OrgkDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<OrgkDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OrgkDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const mut = db.createObjectStore('mutations', {
          keyPath: 'client_uuid',
        });
        mut.createIndex('by_status', 'status');
        mut.createIndex('by_created', 'created_at');

        const photos = db.createObjectStore('photos', { keyPath: 'id' });
        photos.createIndex('by_status', 'status');

        const outlets = db.createObjectStore('outlets', { keyPath: 'id' });
        outlets.createIndex('by_status', 'status');

        db.createObjectStore('catalog', { keyPath: 'id' });

        const visits = db.createObjectStore('visits', { keyPath: 'id' });
        visits.createIndex('by_outlet', 'outlet_id');

        db.createObjectStore('orders', { keyPath: 'id' });
        db.createObjectStore('payments', { keyPath: 'id' });
        db.createObjectStore('kv', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}

// ---- KV (config, server_time, last sync) ----

export async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('kv', { key, value, updated_at: new Date().toISOString() });
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  const rec = await db.get('kv', key);
  return rec?.value as T | undefined;
}

// ---- Mutation queue ----

export async function enqueueMutation(
  m: Omit<QueuedMutation, 'status' | 'attempts' | 'next_attempt_at'>,
): Promise<void> {
  const db = await getDB();
  await db.put('mutations', {
    ...m,
    status: 'pending',
    attempts: 0,
    next_attempt_at: 0,
  });
}

export async function listMutations(): Promise<QueuedMutation[]> {
  const db = await getDB();
  const all = await db.getAll('mutations');
  return all.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function getSendableMutations(now = Date.now()): Promise<
  QueuedMutation[]
> {
  const all = await listMutations();
  return all.filter(
    (m) =>
      (m.status === 'pending' || m.status === 'error') &&
      m.next_attempt_at <= now,
  );
}

export async function updateMutation(
  client_uuid: string,
  patch: Partial<QueuedMutation>,
): Promise<void> {
  const db = await getDB();
  const existing = await db.get('mutations', client_uuid);
  if (!existing) return;
  await db.put('mutations', { ...existing, ...patch });
}

export async function deleteMutation(client_uuid: string): Promise<void> {
  const db = await getDB();
  await db.delete('mutations', client_uuid);
}

export async function pendingMutationCount(): Promise<number> {
  const all = await listMutations();
  return all.filter((m) => m.status !== 'synced' && m.status !== 'duplicate')
    .length;
}

// ---- Photo queue ----

export async function enqueuePhoto(p: QueuedPhoto): Promise<void> {
  const db = await getDB();
  await db.put('photos', p);
}

export async function getPhoto(id: string): Promise<QueuedPhoto | undefined> {
  const db = await getDB();
  return db.get('photos', id);
}

export async function listPhotos(): Promise<QueuedPhoto[]> {
  const db = await getDB();
  return db.getAll('photos');
}

export async function pendingPhotos(): Promise<QueuedPhoto[]> {
  const db = await getDB();
  const all = await db.getAll('photos');
  return all.filter((p) => p.status === 'pending' || p.status === 'error');
}

export async function updatePhoto(
  id: string,
  patch: Partial<QueuedPhoto>,
): Promise<void> {
  const db = await getDB();
  const existing = await db.get('photos', id);
  if (!existing) return;
  await db.put('photos', { ...existing, ...patch });
}

// ---- Reference data cache ----

export async function cacheOutlets(outlets: Outlet[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('outlets', 'readwrite');
  await Promise.all(outlets.map((o) => tx.store.put(o)));
  await tx.done;
}

export async function putOutlet(o: Outlet): Promise<void> {
  const db = await getDB();
  await db.put('outlets', o);
}

export async function getCachedOutlets(): Promise<Outlet[]> {
  const db = await getDB();
  return db.getAll('outlets');
}

export async function getCachedOutlet(id: string): Promise<Outlet | undefined> {
  const db = await getDB();
  return db.get('outlets', id);
}

export async function cacheCatalog(items: CatalogItem[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('catalog', 'readwrite');
  await tx.store.clear();
  await Promise.all(items.map((c) => tx.store.put(c)));
  await tx.done;
}

export async function getCachedCatalog(): Promise<CatalogItem[]> {
  const db = await getDB();
  return db.getAll('catalog');
}

export async function putVisit(v: Visit): Promise<void> {
  const db = await getDB();
  await db.put('visits', v);
}

export async function getVisit(id: string): Promise<Visit | undefined> {
  const db = await getDB();
  return db.get('visits', id);
}

export async function getCachedVisitsForOutlet(
  outletId: string,
): Promise<Visit[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('visits', 'by_outlet', outletId);
  return all.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function putOrder(o: Order): Promise<void> {
  const db = await getDB();
  await db.put('orders', o);
}

export async function putPayment(p: Payment): Promise<void> {
  const db = await getDB();
  await db.put('payments', p);
}

export async function cacheConfig(cfg: TenantConfig): Promise<void> {
  await kvSet('config', cfg);
}

export async function getCachedConfig(): Promise<TenantConfig | undefined> {
  return kvGet<TenantConfig>('config');
}

export async function clearAll(): Promise<void> {
  const db = await getDB();
  for (const store of [
    'mutations',
    'photos',
    'outlets',
    'catalog',
    'visits',
    'orders',
    'payments',
    'kv',
  ] as const) {
    await db.clear(store);
  }
}
