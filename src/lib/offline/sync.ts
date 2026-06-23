// Sync engine — drains the outbound mutation queue and uploads queued photos
// (CONTRACT §7). Runs on reconnect, on a periodic timer, and on demand.
//
// Photo-first ordering: a mutation that references a queued photo (by the
// placeholder token `photo://<id>`) is held back until that photo has uploaded
// and its real URL is patched into the payload. This implements §7.4.

import { api, ApiError } from '@/lib/api/client';
import type { MediaKind, SyncMutation } from '@/types/api';
import {
  deleteMutation,
  getPhoto,
  getSendableMutations,
  pendingMutationCount,
  pendingPhotos,
  updateMutation,
  updatePhoto,
  type QueuedMutation,
} from './db';

export const PHOTO_TOKEN_PREFIX = 'photo://';

const MAX_BACKOFF_MS = 5 * 60_000;
function backoff(attempts: number): number {
  return Math.min(MAX_BACKOFF_MS, 2 ** attempts * 1000);
}

type Listener = (state: SyncState) => void;

export interface SyncState {
  online: boolean;
  syncing: boolean;
  pending: number;
  errors: number;
  lastSyncAt: string | null;
  lastError: string | null;
}

class SyncEngine {
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private state: SyncState = {
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    syncing: false,
    pending: 0,
    errors: 0,
    lastSyncAt: null,
    lastError: null,
  };

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  getState(): SyncState {
    return this.state;
  }

  private emit(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn(this.state);
  }

  async refreshCounts(): Promise<void> {
    const pending = await pendingMutationCount();
    const muts = await getSendableMutations(Number.MAX_SAFE_INTEGER);
    const errors = muts.filter((m) => m.status === 'error').length;
    this.emit({ pending, errors });
  }

  start(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', this.onOnline);
    window.addEventListener('offline', this.onOffline);
    this.timer = setInterval(() => void this.sync(), 30_000);
    void this.refreshCounts();
    void this.sync();
  }

  stop(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('offline', this.onOffline);
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private onOnline = () => {
    this.emit({ online: true });
    void this.sync();
  };
  private onOffline = () => {
    this.emit({ online: false });
  };

  // Upload all pending photo blobs; patch their server URLs back in.
  private async uploadPhotos(): Promise<void> {
    const photos = await pendingPhotos();
    for (const p of photos) {
      try {
        await updatePhoto(p.id, { status: 'uploading' });
        const { url } = await api.uploadMedia(p.blob, p.kind as MediaKind);
        await updatePhoto(p.id, { status: 'uploaded', url });
      } catch (e) {
        await updatePhoto(p.id, {
          status: 'error',
          attempts: p.attempts + 1,
          last_error: (e as Error).message,
        });
      }
    }
  }

  // Resolve photo:// placeholders in a payload to uploaded URLs.
  // Returns null if any referenced photo is not yet uploaded (defer).
  private async resolvePhotoTokens(
    payload: unknown,
  ): Promise<{ resolved: unknown; deferred: boolean }> {
    const json = JSON.stringify(payload ?? null);
    if (!json.includes(PHOTO_TOKEN_PREFIX)) {
      return { resolved: payload, deferred: false };
    }
    const ids = new Set<string>();
    const re = new RegExp(`${PHOTO_TOKEN_PREFIX}([\\w-]+)`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(json))) ids.add(m[1]);

    const map: Record<string, string> = {};
    for (const id of ids) {
      const photo = await getPhoto(id);
      if (!photo || photo.status !== 'uploaded' || !photo.url) {
        return { resolved: payload, deferred: true };
      }
      map[id] = photo.url;
    }
    let replaced = json;
    for (const [id, url] of Object.entries(map)) {
      replaced = replaced.split(`${PHOTO_TOKEN_PREFIX}${id}`).join(url);
    }
    return { resolved: JSON.parse(replaced), deferred: false };
  }

  async sync(): Promise<void> {
    if (this.running) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    this.running = true;
    this.emit({ syncing: true });
    try {
      // 1) Upload photos first so mutations can resolve their URLs.
      await this.uploadPhotos();

      // 2) Build the batch from sendable mutations, resolving photo tokens.
      const sendable = await getSendableMutations();
      const batch: SyncMutation[] = [];
      const included: QueuedMutation[] = [];
      for (const mut of sendable) {
        const { resolved, deferred } = await this.resolvePhotoTokens(
          mut.payload,
        );
        if (deferred) continue; // wait for photo upload on a later pass
        batch.push({
          client_uuid: mut.client_uuid,
          type: mut.type,
          payload: resolved,
          idempotency_key: mut.idempotency_key,
          created_at: mut.created_at,
        });
        included.push(mut);
        await updateMutation(mut.client_uuid, { status: 'syncing' });
      }

      if (batch.length === 0) {
        await this.refreshCounts();
        return;
      }

      // 3) Send the batch. Partial failures don't fail the batch (§7.3).
      const { results } = await api.syncBatch(batch);
      const byUuid = new Map(results.map((r) => [r.client_uuid, r]));

      for (const mut of included) {
        const r = byUuid.get(mut.client_uuid);
        if (!r) {
          // No result returned — treat as transient, requeue.
          await updateMutation(mut.client_uuid, {
            status: 'pending',
            next_attempt_at: Date.now() + backoff(mut.attempts + 1),
          });
          continue;
        }
        if (r.status === 'ok' || r.status === 'duplicate') {
          await deleteMutation(mut.client_uuid);
        } else {
          const attempts = mut.attempts + 1;
          await updateMutation(mut.client_uuid, {
            status: 'error',
            attempts,
            last_error: r.error || 'server rejected mutation',
            next_attempt_at: Date.now() + backoff(attempts),
          });
        }
      }

      this.emit({ lastSyncAt: new Date().toISOString(), lastError: null });
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.status === 0
            ? 'offline'
            : e.message
          : (e as Error).message;
      // Roll any 'syncing' rows back to pending so they retry.
      const stuck = await getSendableMutations(Number.MAX_SAFE_INTEGER);
      for (const m of stuck) {
        if (m.status === 'syncing') {
          await updateMutation(m.client_uuid, { status: 'pending' });
        }
      }
      this.emit({ lastError: msg });
    } finally {
      await this.refreshCounts();
      this.emit({ syncing: false });
      this.running = false;
    }
  }

  // Force a retry of error rows immediately (Sync screen "Retry now").
  async retryErrors(): Promise<void> {
    const muts = await getSendableMutations(Number.MAX_SAFE_INTEGER);
    for (const m of muts) {
      if (m.status === 'error') {
        await updateMutation(m.client_uuid, {
          status: 'pending',
          next_attempt_at: 0,
        });
      }
    }
    await this.sync();
  }
}

export const syncEngine = new SyncEngine();
