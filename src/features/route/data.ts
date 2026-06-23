import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { cacheOutlets, getCachedOutlets } from '@/lib/offline/db';
import {
  getTodayRouteOutletIds,
  setTodayRouteOutletIds,
} from '@/lib/offline/bootstrap';
import type { Outlet } from '@/types/models';

export interface TodayRouteData {
  outlets: Outlet[];
  outletIds: string[];
}

// Hydrate ordered outlets from a list of ids, using cached outlets first and
// falling back to the outlets list endpoint for any that are missing.
async function hydrateOutlets(ids: string[]): Promise<Outlet[]> {
  if (ids.length === 0) return [];
  let byId = new Map((await getCachedOutlets()).map((o) => [o.id, o]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) {
    try {
      const res = await api.listOutlets({ page_size: 200 });
      if (res.items.length) await cacheOutlets(res.items);
      byId = new Map(
        [...(await getCachedOutlets()), ...res.items].map((o) => [o.id, o]),
      );
    } catch {
      /* offline — use what's cached */
    }
  }
  return ids.map((id) => byId.get(id)).filter((o): o is Outlet => !!o);
}

export function useTodayRoute() {
  return useQuery<TodayRouteData>({
    queryKey: ['route-today'],
    queryFn: async () => {
      try {
        // /routes/today returns the route doc + ordered outlet_ids only.
        const res = await api.routesToday();
        const ids = res.outlet_ids ?? [];
        await setTodayRouteOutletIds(ids);
        const outlets = await hydrateOutlets(ids);
        return { outlets, outletIds: ids };
      } catch {
        // offline: reconstruct from cached ids + cached outlets
        const ids = await getTodayRouteOutletIds();
        const outlets = await hydrateOutlets(ids);
        return { outlets, outletIds: ids };
      }
    },
    staleTime: 30_000,
  });
}
