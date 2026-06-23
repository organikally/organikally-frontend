// Outlet data hooks — offline-first. Reads from IndexedDB cache immediately,
// refreshes from the API when online (TanStack Query), and merges optimistic
// local entities so onboarded outlets show up before sync.

import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api/client';
import {
  getCachedOutlet,
  getCachedOutlets,
  getCachedVisitsForOutlet,
  cacheOutlets,
  putVisit,
} from '@/lib/offline/db';
import type { Outlet, Visit } from '@/types/models';

export function useOutlets() {
  return useQuery<Outlet[]>({
    queryKey: ['outlets'],
    queryFn: async () => {
      try {
        const res = await api.listOutlets({ page_size: 200 });
        await cacheOutlets(res.items);
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 0) {
          // non-network error: still fall back to cache
        }
      }
      return getCachedOutlets();
    },
    staleTime: 30_000,
  });
}

export function useOutlet(id: string | undefined) {
  return useQuery<Outlet | undefined>({
    queryKey: ['outlet', id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return undefined;
      // local-only optimistic outlet
      if (id.startsWith('local:')) return getCachedOutlet(id);
      try {
        const o = await api.getOutlet(id);
        await cacheOutlets([o]);
        return o;
      } catch {
        return getCachedOutlet(id);
      }
    },
  });
}

export function useOutletVisits(outletId: string | undefined) {
  return useQuery<Visit[]>({
    queryKey: ['outlet-visits', outletId],
    enabled: !!outletId,
    queryFn: async () => {
      if (!outletId) return [];
      if (!outletId.startsWith('local:')) {
        try {
          const res = await api.outletVisits(outletId);
          for (const v of res.items) await putVisit(v);
        } catch {
          /* offline — use cache */
        }
      }
      return getCachedVisitsForOutlet(outletId);
    },
  });
}
