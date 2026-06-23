import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { cacheCatalog, getCachedCatalog } from '@/lib/offline/db';
import type { CatalogItem } from '@/types/models';
import type { CartLine } from '@/stores/visitFlow';

export function useCatalog() {
  return useQuery<CatalogItem[]>({
    queryKey: ['catalog'],
    queryFn: async () => {
      try {
        const res = await api.catalog();
        // Catalog comes back as a list envelope { items, total, warehouse_id }.
        const items = res.items ?? [];
        // mark orderable based on stock if backend omits it
        const normalized = items.map((i) => ({
          ...i,
          orderable: i.orderable ?? i.qty_available > 0,
        }));
        await cacheCatalog(normalized);
        return normalized;
      } catch {
        return getCachedCatalog();
      }
    },
    staleTime: 60_000,
  });
}

export interface CartTotals {
  subtotal: number;
  discountTotal: number;
  gstTotal: number;
  total: number;
  units: number;
  skuCount: number;
}

// Price from SKU.ptr (price-to-retailer), apply line discount, add GST.
export function computeCartTotals(
  cart: Record<string, CartLine>,
  catalog: CatalogItem[],
): CartTotals {
  let subtotal = 0;
  let discountTotal = 0;
  let gstTotal = 0;
  let units = 0;
  let skuCount = 0;
  for (const line of Object.values(cart)) {
    const sku = catalog.find((c) => c.id === line.sku_id);
    if (!sku) continue;
    skuCount += 1;
    units += line.qty;
    const gross = sku.ptr * line.qty;
    const discount = (gross * line.discount_pct) / 100;
    const net = gross - discount;
    const gst = (net * sku.gst_rate) / 100;
    subtotal += gross;
    discountTotal += discount;
    gstTotal += gst;
  }
  const total = subtotal - discountTotal + gstTotal;
  return { subtotal, discountTotal, gstTotal, total, units, skuCount };
}
