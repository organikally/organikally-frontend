import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { getDB } from '@/lib/offline/db';
import type { Order, Payment } from '@/types/models';

async function cachedOrders(): Promise<Order[]> {
  const db = await getDB();
  const all = await db.getAll('orders');
  return all.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function useOrders() {
  return useQuery<Order[]>({
    queryKey: ['orders'],
    queryFn: async () => {
      try {
        const res = await api.listOrders({});
        const db = await getDB();
        for (const o of res.items) await db.put('orders', o);
      } catch {
        /* offline */
      }
      return cachedOrders();
    },
    staleTime: 30_000,
  });
}

export function useOrder(id: string | undefined) {
  return useQuery<Order | undefined>({
    queryKey: ['order', id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return undefined;
      const db = await getDB();
      if (id.startsWith('local:')) return db.get('orders', id);
      try {
        const o = await api.getOrder(id);
        await db.put('orders', o);
        return o;
      } catch {
        return db.get('orders', id);
      }
    },
  });
}

export function usePayments(outletId?: string) {
  return useQuery<Payment[]>({
    queryKey: ['payments', outletId],
    queryFn: async () => {
      const db = await getDB();
      try {
        const res = await api.listPayments(
          outletId ? { outlet_id: outletId } : {},
        );
        for (const p of res.items) await db.put('payments', p);
      } catch {
        /* offline */
      }
      const all = await db.getAll('payments');
      return outletId ? all.filter((p) => p.outlet_id === outletId) : all;
    },
  });
}
