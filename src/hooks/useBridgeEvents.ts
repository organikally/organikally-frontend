import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onBridgeEvent } from '@/lib/bridge/client';

// Deep-link payload the shell forwards with a tapped notification. All fields
// are optional; we route to the most specific target available.
interface PushOpenedData {
  route?: string; // explicit in-app path, e.g. "/orders/abc"
  outlet_id?: string;
  order_id?: string;
  visit_id?: string;
  type?: 'outlet' | 'order' | 'visit' | 'route' | string;
}

// Wires the unsolicited shell -> web events into the router. Mounted once, high
// in the tree (inside RouterProvider so navigation is available).
export function useBridgeEvents(): void {
  const nav = useNavigate();

  useEffect(() => {
    const offOpened = onBridgeEvent('push.opened', (data) => {
      const d = (data ?? {}) as PushOpenedData;
      if (typeof d.route === 'string' && d.route.startsWith('/')) {
        nav(d.route);
      } else if (d.outlet_id) {
        nav(`/outlets/${d.outlet_id}`);
      } else if (d.order_id) {
        nav(`/orders/${d.order_id}`);
      } else if (d.type === 'route' || d.type === 'visit') {
        nav('/today');
      } else {
        nav('/today');
      }
    });

    // Android hardware back / shell back button. Give any open modal a chance to
    // close first (Sheet listens for this and preventDefault()s); otherwise pop
    // the route when there's history to go back to.
    const offBack = onBridgeEvent('app.backPressed', () => {
      const consumed =
        typeof window !== 'undefined' &&
        !window.dispatchEvent(
          new CustomEvent('orgk:backpressed', { cancelable: true }),
        );
      if (consumed) return;
      if (typeof window !== 'undefined' && window.history.length > 1) {
        nav(-1);
      }
    });

    return () => {
      offOpened();
      offBack();
    };
  }, [nav]);
}
