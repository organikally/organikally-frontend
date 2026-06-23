// Offline bootstrap loader (CONTRACT §7.1): on login/online, pull outlets,
// today's route, stock-aware catalog and tenant config into IndexedDB so the
// app works fully offline after first load.

import { api } from '@/lib/api/client';
import {
  cacheCatalog,
  cacheConfig,
  cacheOutlets,
  getCachedCatalog,
  getCachedConfig,
  getCachedOutlets,
  kvGet,
  kvSet,
} from './db';
import type { Outlet, CatalogItem, TenantConfig } from '@/types/models';

const LAST_BOOTSTRAP_KEY = 'last_bootstrap_at';
const TODAY_ROUTE_IDS_KEY = 'today_route_outlet_ids';

export async function runBootstrap(): Promise<void> {
  const since = await kvGet<string>(LAST_BOOTSTRAP_KEY);
  const data = await api.bootstrap(since ?? undefined);
  await cacheOutlets(data.outlets);
  await cacheCatalog(data.catalog);
  await cacheConfig(data.config);
  // The backend returns route_today as the route doc (with ordered outlet_ids);
  // the outlets themselves are already in `data.outlets`. Persist the ordering.
  const rt = data.route_today as
    | { outlet_ids?: string[]; outlets?: Outlet[] }
    | null;
  const routeOutlets = (rt?.outlets ?? []) as Outlet[];
  if (routeOutlets.length) await cacheOutlets(routeOutlets);
  const routeIds =
    rt?.outlet_ids ?? routeOutlets.map((o) => o.id);
  await kvSet(TODAY_ROUTE_IDS_KEY, routeIds);
  await kvSet('server_time', data.server_time);
  await kvSet(LAST_BOOTSTRAP_KEY, new Date().toISOString());
}

export async function getTodayRouteOutletIds(): Promise<string[]> {
  return (await kvGet<string[]>(TODAY_ROUTE_IDS_KEY)) ?? [];
}

export async function setTodayRouteOutletIds(ids: string[]): Promise<void> {
  await kvSet(TODAY_ROUTE_IDS_KEY, ids);
}

export async function readCachedOutlets(): Promise<Outlet[]> {
  return getCachedOutlets();
}

export async function readCachedCatalog(): Promise<CatalogItem[]> {
  return getCachedCatalog();
}

export async function readCachedConfig(): Promise<TenantConfig | undefined> {
  return getCachedConfig();
}

export const DEFAULT_CONFIG: TenantConfig = {
  geofence_radius_m: 100,
  gps_accuracy_threshold_m: 50,
  credit_policy: { over_limit: 'require_approval', overdue: 'block' },
  reason_codes: [
    'not_interested',
    'no_shelf_space',
    'decision_pending',
    'owner_absent',
    'shop_closed',
    'price_issue',
    'sufficient_stock',
    'other',
  ],
  outlet_custom_fields: [],
  dormant_days: 45,
};
