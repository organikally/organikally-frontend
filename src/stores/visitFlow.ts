// Active-visit flow state. A visit spans several screens (check-in → pitch →
// catalog/order → payment → outcome). We keep its identity + collected data in
// a Zustand store + IndexedDB kv so it survives reloads and offline use.

import { create } from 'zustand';
import { kvGet, kvSet } from '@/lib/offline/db';
import type { CatalogItem } from '@/types/models';
import type { PaymentMethod, PaymentType } from '@/types/enums';

const KV_KEY = 'active_visit';

export interface CartLine {
  sku_id: string;
  qty: number;
  discount_pct: number;
}

export interface DraftPayment {
  type: PaymentType;
  method: PaymentMethod;
  amount_collected: number;
  credit_days: number;
  reference?: string;
}

export interface ActiveVisit {
  visitClientUuid: string;
  outletId: string;
  outletName: string;
  routeId?: string | null;
  startedAt: string;
  inFence: boolean;
  // pitch
  demoedSkuIds: string[];
  pitchNotes: string;
  // order
  cart: Record<string, CartLine>; // by sku_id
  orderClientUuid?: string;
  payment?: DraftPayment;
}

interface VisitFlowState {
  active: ActiveVisit | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  start: (v: Omit<ActiveVisit, 'cart' | 'demoedSkuIds' | 'pitchNotes'>) => void;
  setCartQty: (item: CatalogItem, qty: number) => void;
  setCartDiscount: (skuId: string, pct: number) => void;
  toggleDemoed: (skuId: string) => void;
  setPitchNotes: (notes: string) => void;
  setPayment: (p: DraftPayment) => void;
  setOrderClientUuid: (id: string) => void;
  clear: () => void;
}

async function persist(active: ActiveVisit | null) {
  await kvSet(KV_KEY, active);
}

export const useVisitFlow = create<VisitFlowState>((set, get) => ({
  active: null,
  hydrated: false,

  async hydrate() {
    const stored = await kvGet<ActiveVisit>(KV_KEY);
    set({ active: stored ?? null, hydrated: true });
  },

  start(v) {
    const active: ActiveVisit = {
      ...v,
      demoedSkuIds: [],
      pitchNotes: '',
      cart: {},
    };
    set({ active });
    void persist(active);
  },

  setCartQty(item, qty) {
    const a = get().active;
    if (!a) return;
    const cart = { ...a.cart };
    if (qty <= 0) delete cart[item.id];
    else
      cart[item.id] = {
        sku_id: item.id,
        qty,
        discount_pct: cart[item.id]?.discount_pct ?? 0,
      };
    const next = { ...a, cart };
    set({ active: next });
    void persist(next);
  },

  setCartDiscount(skuId, pct) {
    const a = get().active;
    if (!a || !a.cart[skuId]) return;
    const cart = {
      ...a.cart,
      [skuId]: { ...a.cart[skuId], discount_pct: Math.max(0, Math.min(100, pct)) },
    };
    const next = { ...a, cart };
    set({ active: next });
    void persist(next);
  },

  toggleDemoed(skuId) {
    const a = get().active;
    if (!a) return;
    const has = a.demoedSkuIds.includes(skuId);
    const demoedSkuIds = has
      ? a.demoedSkuIds.filter((x) => x !== skuId)
      : [...a.demoedSkuIds, skuId];
    const next = { ...a, demoedSkuIds };
    set({ active: next });
    void persist(next);
  },

  setPitchNotes(notes) {
    const a = get().active;
    if (!a) return;
    const next = { ...a, pitchNotes: notes };
    set({ active: next });
    void persist(next);
  },

  setPayment(p) {
    const a = get().active;
    if (!a) return;
    const next = { ...a, payment: p };
    set({ active: next });
    void persist(next);
  },

  setOrderClientUuid(id) {
    const a = get().active;
    if (!a) return;
    const next = { ...a, orderClientUuid: id };
    set({ active: next });
    void persist(next);
  },

  clear() {
    set({ active: null });
    void persist(null);
  },
}));
