// Single source of truth for resolving a notification's deep-link target.
//
// Used by BOTH the in-app notifications list (tap → navigate) and the native
// `push.opened` bridge event (tapped a system notification), so a push and its
// in-app twin always land on the same screen.
//
// The backend's `data.route` is treated as a HINT, never as gospel: it has
// historically carried admin-portal paths (`/inventory?warehouse_id=…`) and
// routes this app has never had (`/visits/:id`, `/payments/:id`). Those match
// nothing, hit the router's `*` catch-all and silently dump the rep on Today.
// So every candidate is matched against the app's real route table
// (`app/routePaths.ts`) before it is handed to the router, and anything that
// does not match is rebuilt from the ids the notification carries.
//
// Resolution order (ANALYTICS_FIX_CONTRACT §5):
//   1. data.route          — only if the router can actually match it
//   2. /orders/<order_id>
//   3. /outlets/<outlet_id>   (visit_id / payment_id have no standalone screen;
//                              both notifications also carry outlet_id, and the
//                              outlet detail screen carries visit history and
//                              the outstanding balance)
//   4. /notifications         — stay on the list rather than teleport to Today

import { matchPath } from 'react-router-dom';
import { APP_ROUTE_PATTERNS, ROUTE } from '@/app/routePaths';
import type { NotificationData } from '@/types/models';

export const NOTIFICATIONS_ROUTE: string = ROUTE.notifications;

/** True when the router has a pattern that matches this pathname. */
export function isKnownRoute(pathname: string): boolean {
  return APP_ROUTE_PATTERNS.some(
    (pattern) => matchPath({ path: pattern, end: true }, pathname) !== null,
  );
}

// An in-app path only: no absolute URLs, no protocol-relative "//host", no
// backslash tricks — a notification must never be able to navigate off-app.
function asInAppPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (value.includes('\\')) return null;
  return value;
}

/**
 * Normalise a candidate path and keep it only if the router can match it.
 * Query string and hash are preserved (a matchable route may take params);
 * they play no part in matching.
 */
export function resolveKnownRoute(raw: unknown): string | null {
  const value = asInAppPath(raw);
  if (!value) return null;

  const cut = value.search(/[?#]/);
  const rawPath = cut === -1 ? value : value.slice(0, cut);
  const suffix = cut === -1 ? '' : value.slice(cut);

  // Tolerate a trailing slash from the emitter; "/outlets/" is still "/outlets".
  const pathname =
    rawPath.length > 1 ? rawPath.replace(/\/+$/, '') || '/' : rawPath;

  if (!isKnownRoute(pathname)) return null;
  return pathname + suffix;
}

// Ids come off the wire as `unknown`. Accept a plain, single-segment id only.
function idSegment(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const id = raw.trim();
  if (!id || /[/\\?#\s]/.test(id)) return null;
  return encodeURIComponent(id);
}

export function notificationTarget(data?: NotificationData | null): string {
  const d = data ?? {};

  // 1. The backend's own route — but only if it exists in this app.
  const explicit = resolveKnownRoute(d.route);
  if (explicit) return explicit;

  // 2/3. Rebuild from the ids the notification carries. Both are re-validated
  // so we can only ever hand the router something it matches.
  const orderId = idSegment(d.order_id);
  if (orderId) {
    const target = resolveKnownRoute(`/orders/${orderId}`);
    if (target) return target;
  }

  const outletId = idSegment(d.outlet_id);
  if (outletId) {
    const target = resolveKnownRoute(`/outlets/${outletId}`);
    if (target) return target;
  }

  // 4. Nothing addressable (e.g. inventory.low_stock, which is an admin
  // concern): keep the rep on the notification list instead of bouncing them.
  return NOTIFICATIONS_ROUTE;
}
