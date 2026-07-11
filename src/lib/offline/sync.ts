// Sync engine — drains the outbound mutation queue and uploads queued photos
// (CONTRACT §7). Runs on reconnect, on a periodic timer, and on demand.
//
// Photo-first ordering: a mutation that references a queued photo (by the
// placeholder token `photo://<id>`) is held back until that photo has uploaded
// and its real URL is patched into the payload. This implements §7.4.

import { api, ApiError } from '@/lib/api/client';
import type { MediaKind, MutationType, SyncMutation } from '@/types/api';
import {
  deleteMutation,
  getPhoto,
  getSendableMutations,
  pendingMutationCount,
  pendingPhotos,
  replaceOptimisticEntity,
  rewriteLocalReferences,
  rewriteQueuedMutationRefs,
  updateMutation,
  updatePhoto,
  type QueuedMutation,
} from './db';

export const PHOTO_TOKEN_PREFIX = 'photo://';

const MAX_BACKOFF_MS = 5 * 60_000;
// A photo that keeps failing to upload is dead-lettered after this many
// attempts so it stops blocking (and stops retrying) its owning mutation.
const MAX_PHOTO_ATTEMPTS = 5;

function backoff(attempts: number): number {
  return Math.min(MAX_BACKOFF_MS, 2 ** attempts * 1000);
}

function isAuthError(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 401 || e.status === 403);
}

// Mutation types that create a brand-new entity we optimistically stored under a
// `local:<uuid>` key (and therefore need reconciling to a server id).
const CREATE_TYPES = new Set<MutationType>([
  'outlet.create',
  'visit.check_in',
  'order.create',
  'payment.create',
]);

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
  // Set when the backend rejects our token (401/403). We stop draining until a
  // fresh login clears it — otherwise we'd retry forever with a dead token and
  // strand the day's queue. The queue itself is preserved for replay post-login.
  private authFailed = false;
  private authHandler: (() => void) | null = null;
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

  // Wired by the app to tear down the session + route to login on token expiry.
  onAuthError(fn: () => void): void {
    this.authHandler = fn;
  }

  // Called after a successful (re)login so the loop resumes.
  resetAuth(): void {
    this.authFailed = false;
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

  // Upload due photo blobs; patch their server URLs back in. Backoff-gated,
  // frees the blob after upload, and dead-letters a permanently-failing photo
  // so it stops blocking its owning mutation. Re-throws auth errors so the
  // caller can stop the whole drain.
  private async uploadPhotos(): Promise<void> {
    const now = Date.now();
    const photos = await pendingPhotos(now);
    for (const p of photos) {
      try {
        await updatePhoto(p.id, { status: 'uploading' });
        if (!p.blob) throw new Error('photo blob missing');
        const { url } = await api.uploadMedia(p.blob, p.kind as MediaKind);
        // Keep the record (url resolves the photo:// token) but drop the blob.
        await updatePhoto(p.id, {
          status: 'uploaded',
          url,
          blob: undefined,
          last_error: undefined,
        });
      } catch (e) {
        if (isAuthError(e)) {
          // Not the photo's fault — reset it and let the drain handle auth.
          await updatePhoto(p.id, { status: 'pending' });
          throw e;
        }
        // Transient network failures shouldn't burn the attempt budget.
        const network = e instanceof ApiError && e.status === 0;
        const attempts = network ? p.attempts : p.attempts + 1;
        const dead = attempts >= MAX_PHOTO_ATTEMPTS;
        await updatePhoto(p.id, {
          status: dead ? 'dead' : 'error',
          attempts,
          last_error: (e as Error).message,
          next_attempt_at: dead ? 0 : Date.now() + backoff(attempts),
        });
      }
    }
  }

  // Resolve photo:// placeholders in a payload to uploaded URLs.
  //  - uploaded  -> swap the token for the real URL
  //  - dead/gone -> drop the token (null it out) so the mutation can still send
  //  - otherwise -> defer (wait for the upload on a later pass)
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

    const urls: Record<string, string> = {};
    const dead: string[] = [];
    for (const id of ids) {
      const photo = await getPhoto(id);
      if (photo && photo.status === 'uploaded' && photo.url) {
        urls[id] = photo.url;
      } else if (!photo || photo.status === 'dead') {
        dead.push(id); // give up on this photo; send the mutation without it
      } else {
        return { resolved: payload, deferred: true };
      }
    }

    let replaced = json;
    // Dead tokens become JSON null (the quoted form), so `photo_url:"photo://x"`
    // -> `photo_url:null` and array entries -> `null` (filtered out below).
    for (const id of dead) {
      replaced = replaced
        .split(`"${PHOTO_TOKEN_PREFIX}${id}"`)
        .join('null');
    }
    for (const [id, url] of Object.entries(urls)) {
      replaced = replaced.split(`${PHOTO_TOKEN_PREFIX}${id}`).join(url);
    }
    const parsed = JSON.parse(replaced);
    if (dead.length && parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.photos)) {
        obj.photos = obj.photos.filter((x) => x != null && x !== '');
      }
    }
    return { resolved: parsed, deferred: false };
  }

  async sync(): Promise<void> {
    if (this.running) return;
    if (this.authFailed) return; // token dead; wait for re-login
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

      // Map optimistic local ids -> server ids so we can reconcile after the
      // loop (rewrite dependents + collapse the optimistic row).
      const idMap: Record<string, string> = {};
      const reconciled: Array<{ type: MutationType; client_uuid: string; server_id?: string }> = [];

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
          if (r.server_id && CREATE_TYPES.has(mut.type)) {
            idMap[`local:${mut.client_uuid}`] = r.server_id;
          }
          reconciled.push({
            type: mut.type,
            client_uuid: mut.client_uuid,
            server_id: r.server_id,
          });
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

      // 4) Reconcile server ids (§7.3): drop/replace each optimistic
      // `local:<uuid>` record with its server copy, then rewrite that id
      // wherever it's still referenced — queued mutations and cached
      // dependents — so lists show exactly one row per entity.
      for (const rec of reconciled) {
        await replaceOptimisticEntity(rec.type, rec.client_uuid, rec.server_id);
      }
      await rewriteQueuedMutationRefs(idMap);
      await rewriteLocalReferences(idMap);

      this.emit({ lastSyncAt: new Date().toISOString(), lastError: null });
    } catch (e) {
      // Roll any 'syncing' rows back to pending so they retry (queue preserved).
      const stuck = await getSendableMutations(Number.MAX_SAFE_INTEGER);
      for (const m of stuck) {
        if (m.status === 'syncing') {
          await updateMutation(m.client_uuid, { status: 'pending' });
        }
      }

      if (isAuthError(e)) {
        // Token expired and there's no refresh token: stop draining and hand
        // off to the app to clear the session and route to login. The queue is
        // left intact so it replays after the rep signs back in.
        this.authFailed = true;
        this.emit({ lastError: 'Session expired — please sign in again.' });
        this.authHandler?.();
      } else {
        const msg =
          e instanceof ApiError
            ? e.status === 0
              ? 'offline'
              : e.message
            : (e as Error).message;
        this.emit({ lastError: msg });
      }
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
