import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { onBridgeEvent, reportBackConsumed } from '@/lib/bridge/client';
import { notificationTarget } from '@/lib/notifications/deepLink';
import { invalidateNotifications } from '@/features/notifications/data';
import { registerPushToken } from '@/lib/push/registerPush';
import { useSession } from '@/stores/session';
import type { NotificationData } from '@/types/models';

// Wires the unsolicited shell -> web events into the router. Mounted once, high
// in the tree (inside RouterProvider so navigation is available).
export function useBridgeEvents(): void {
  const nav = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    // Tapped a system notification. Routes via the SAME resolver the in-app
    // list uses (data.route → outlet_id → order_id → today).
    const offOpened = onBridgeEvent('push.opened', (data) => {
      nav(notificationTarget((data ?? {}) as NotificationData));
    });

    // App returned to foreground: re-register the push token (best-effort) and
    // pull fresh notifications so the bell badge is current. No-op pre-auth.
    const offState = onBridgeEvent('app.state', (data) => {
      const state =
        typeof data === 'string'
          ? data
          : (data as { state?: string } | null)?.state;
      if (state && state !== 'active') return;
      if (!useSession.getState().token) return;
      void registerPushToken();
      invalidateNotifications(qc);
    });

    // Android hardware back / shell back button. Give any open modal a chance to
    // close first (Sheet listens for this and preventDefault()s); otherwise pop
    // the route when there's history to go back to.
    const offBack = onBridgeEvent('app.backPressed', (data) => {
      const id = (data as { id?: string } | null)?.id;
      const consumed =
        typeof window !== 'undefined' &&
        !window.dispatchEvent(
          new CustomEvent('orgk:backpressed', { cancelable: true }),
        );
      if (id) {
        // New shell contract: report whether we handled it; if not, the shell
        // navigates the WebView back / exits — we must NOT also nav (double-nav).
        reportBackConsumed(id, consumed);
        return;
      }
      // Legacy shell (no request/response): fall back to web-side navigation.
      if (consumed) return;
      if (typeof window !== 'undefined' && window.history.length > 1) {
        nav(-1);
      }
    });

    return () => {
      offOpened();
      offState();
      offBack();
    };
  }, [nav, qc]);
}
