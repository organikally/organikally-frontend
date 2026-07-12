// Single source of truth for resolving a notification's deep-link target.
//
// Used by BOTH the in-app notifications list (tap → navigate) and the native
// `push.opened` bridge event (tapped a system notification), so a push and its
// in-app twin always land on the same screen. Routes to the most specific
// target the `data` payload offers, defaulting to Today.

import type { NotificationData } from '@/types/models';

export function notificationTarget(data?: NotificationData | null): string {
  const d = data ?? {};
  if (typeof d.route === 'string' && d.route.startsWith('/')) return d.route;
  if (d.outlet_id) return `/outlets/${d.outlet_id}`;
  if (d.order_id) return `/orders/${d.order_id}`;
  // There is no standalone visit route — visits live under their outlet's
  // detail screen — so a bare visit_id falls through to Today.
  return '/today';
}
