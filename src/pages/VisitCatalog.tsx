import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { VisitStepper } from '@/components/domain/VisitStepper';
import { useVisitFlow } from '@/stores/visitFlow';
import { useCatalog, computeCartTotals } from '@/features/catalog/data';
import { inr } from '@/lib/format';
import {
  PlusIcon,
  MinusIcon,
  SearchIcon,
  CartIcon,
} from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import type { CatalogItem } from '@/types/models';

export function VisitCatalog() {
  const nav = useNavigate();
  const active = useVisitFlow((s) => s.active);
  const setQty = useVisitFlow((s) => s.setCartQty);
  const { data: catalog, isLoading } = useCatalog();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('all');

  const categories = useMemo(() => {
    const set = new Set((catalog ?? []).map((c) => c.category));
    return ['all', ...Array.from(set)];
  }, [catalog]);

  const filtered = useMemo(() => {
    let list = catalog ?? [];
    if (cat !== 'all') list = list.filter((c) => c.category === cat);
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(t) || c.code.toLowerCase().includes(t),
      );
    }
    return list;
  }, [catalog, cat, q]);

  const totals = useMemo(
    () => computeCartTotals(active?.cart ?? {}, catalog ?? []),
    [active?.cart, catalog],
  );

  if (!active)
    return (
      <div>
        <TopBar title="Catalog" back />
        <EmptyState
          title="No active visit"
          action={<Button onClick={() => nav('/today')}>Go to today</Button>}
        />
      </div>
    );

  return (
    <div className="pb-32">
      <TopBar title="Catalog" subtitle={active.outletName} back />
      <div className="px-4">
        <VisitStepper current="Order" />
      </div>

      <div className="space-y-3 p-4 pt-0">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products"
            className="field-input pl-10"
          />
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                'pill tap !px-3',
                cat === c ? 'bg-brand text-cream' : 'bg-surface-2 text-muted',
              )}
            >
              {c === 'all' ? 'All' : c}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No products" />
        ) : (
          <div className="space-y-2.5">
            {filtered.map((sku) => (
              <CatalogRow
                key={sku.id}
                sku={sku}
                qty={active.cart[sku.id]?.qty ?? 0}
                onQty={(n) => setQty(sku, n)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Cart bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl border-t border-line bg-surface/98 p-3 backdrop-blur pb-safe">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-muted">
            <CartIcon className="h-4 w-4" />
            {totals.skuCount} items · {totals.units} units
          </span>
          <span className="font-semibold text-ink">{inr(totals.total)}</span>
        </div>
        <Button
          variant="primary"
          size="lg"
          block
          disabled={totals.skuCount === 0}
          onClick={() => nav('/visit/order')}
        >
          Review order
        </Button>
      </div>
    </div>
  );
}

function CatalogRow({
  sku,
  qty,
  onQty,
}: {
  sku: CatalogItem;
  qty: number;
  onQty: (n: number) => void;
}) {
  const out = !sku.orderable || sku.qty_available <= 0;
  const low = !out && sku.qty_available <= (sku.moq || 1) * 2;
  const step = sku.moq || 1;

  return (
    <Card className={cn('!p-3', out && 'opacity-70')}>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-surface-2 text-lg">
          <span aria-hidden>🫙</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-ink">{sku.name}</h3>
          <p className="text-xs text-muted">
            {sku.pack_size} · MOQ {sku.moq || 1} · GST {sku.gst_rate}%
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-semibold text-brand">{inr(sku.ptr)}</span>
            <span className="text-xs text-muted line-through">
              MRP {inr(sku.mrp)}
            </span>
            {out ? (
              <Pill tone="danger">Out of stock</Pill>
            ) : low ? (
              <Pill tone="warning">Low · {sku.qty_available}</Pill>
            ) : (
              <Pill tone="success">{sku.qty_available} in stock</Pill>
            )}
          </div>
        </div>
      </div>

      {!out && (
        <div className="mt-2.5 flex items-center justify-end gap-2">
          {qty > 0 ? (
            <>
              <Stepper
                value={qty}
                step={step}
                max={sku.qty_available}
                onChange={onQty}
              />
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              leftIcon={<PlusIcon className="h-4 w-4" />}
              onClick={() => onQty(step)}
              className="!border-brand"
            >
              Add
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function Stepper({
  value,
  step,
  max,
  onChange,
}: {
  value: number;
  step: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(0, value - step))}
        className="tap flex h-10 w-10 items-center justify-center rounded-pill border-2 border-line text-ink active:bg-surface-2"
        aria-label="Decrease"
      >
        <MinusIcon className="h-5 w-5" />
      </button>
      <input
        value={value}
        onChange={(e) => {
          const n = Math.max(0, Math.min(max, Number(e.target.value) || 0));
          onChange(n);
        }}
        inputMode="numeric"
        className="w-14 rounded-card border border-line py-2 text-center font-semibold text-ink"
      />
      <button
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={value >= max}
        className="tap flex h-10 w-10 items-center justify-center rounded-pill border-2 border-brand text-brand active:bg-brand/5 disabled:opacity-40"
        aria-label="Increase"
      >
        <PlusIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
