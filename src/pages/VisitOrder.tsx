import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/Spinner';
import { VisitStepper } from '@/components/domain/VisitStepper';
import { toast } from '@/components/ui/Toast';
import { useVisitFlow } from '@/stores/visitFlow';
import { useCatalog, computeCartTotals } from '@/features/catalog/data';
import { inr, addDaysIso } from '@/lib/format';
import { TrashRow } from '@/components/domain/TrashRow';
import {
  enqueueOrderCreate,
  newClientUuid,
} from '@/lib/offline/mutations';
import type { OrderCreateRequest } from '@/types/api';

export function VisitOrder() {
  const nav = useNavigate();
  const active = useVisitFlow((s) => s.active);
  const setQty = useVisitFlow((s) => s.setCartQty);
  const setDiscount = useVisitFlow((s) => s.setCartDiscount);
  const setOrderUuid = useVisitFlow((s) => s.setOrderClientUuid);
  const { data: catalog } = useCatalog();
  const [edd, setEdd] = useState(addDaysIso(3));
  const [submitting, setSubmitting] = useState(false);

  const lines = useMemo(() => {
    if (!active) return [];
    return Object.values(active.cart)
      .map((line) => {
        const sku = (catalog ?? []).find((c) => c.id === line.sku_id);
        return sku ? { line, sku } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
  }, [active, catalog]);

  const totals = useMemo(
    () => computeCartTotals(active?.cart ?? {}, catalog ?? []),
    [active?.cart, catalog],
  );

  if (!active)
    return (
      <div>
        <TopBar title="Order" back />
        <EmptyState
          title="No active visit"
          action={<Button onClick={() => nav('/today')}>Go to today</Button>}
        />
      </div>
    );

  async function submit() {
    if (lines.length === 0) return toast.error('Cart is empty');
    setSubmitting(true);
    try {
      const client_uuid = active!.orderClientUuid ?? newClientUuid();
      const idempotency_key = client_uuid;
      const body: OrderCreateRequest = {
        outlet_id: active!.outletId,
        visit_id: null, // server links via visit client_uuid on replay
        line_items: lines.map(({ line }) => ({
          sku_id: line.sku_id,
          qty: line.qty,
          discount_pct: line.discount_pct,
        })),
        expected_delivery_date: edd,
        client_uuid,
        idempotency_key,
      };
      const qtyById = Object.fromEntries(
        lines.map(({ line }) => [line.sku_id, line.qty]),
      );
      await enqueueOrderCreate(body, { items: catalog ?? [], qtyById });
      setOrderUuid(client_uuid);
      toast.success('Order queued');
      nav('/visit/payment');
    } catch (e) {
      toast.error((e as Error).message || 'Failed to queue order');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pb-32">
      <TopBar title="Review order" subtitle={active.outletName} back />
      <div className="px-4">
        <VisitStepper current="Order" />
      </div>

      <div className="space-y-3 p-4 pt-0">
        {lines.length === 0 ? (
          <EmptyState
            title="No items"
            action={
              <Button onClick={() => nav('/visit/catalog')}>Add products</Button>
            }
          />
        ) : (
          lines.map(({ line, sku }) => {
            const gross = sku.ptr * line.qty;
            const disc = (gross * line.discount_pct) / 100;
            const net = gross - disc;
            const gst = (net * sku.gst_rate) / 100;
            return (
              <Card key={sku.id} className="!p-3">
                <TrashRow onDelete={() => setQty(sku, 0)}>
                  <h3 className="font-semibold text-ink">{sku.name}</h3>
                  <p className="text-xs text-muted">
                    {line.qty} × {inr(sku.ptr)} = {inr(gross)}
                  </p>
                </TrashRow>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Input
                    label="Qty"
                    type="number"
                    inputMode="numeric"
                    value={line.qty}
                    onChange={(e) =>
                      setQty(sku, Math.max(0, Number(e.target.value) || 0))
                    }
                  />
                  <Input
                    label="Discount %"
                    type="number"
                    inputMode="decimal"
                    value={line.discount_pct}
                    onChange={(e) =>
                      setDiscount(sku.id, Number(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-sm">
                  <span className="text-muted">
                    +GST {sku.gst_rate}% ({inr(gst)})
                  </span>
                  <span className="font-semibold text-ink">
                    {inr(net + gst)}
                  </span>
                </div>
              </Card>
            );
          })
        )}

        {lines.length > 0 && (
          <>
            <Card>
              <Input
                label="Expected delivery date"
                type="date"
                value={edd}
                onChange={(e) => setEdd(e.target.value)}
              />
            </Card>
            <Card>
              <Row label="Subtotal" value={inr(totals.subtotal)} />
              <Row label="Discount" value={`- ${inr(totals.discountTotal)}`} />
              <Row label="GST" value={inr(totals.gstTotal)} />
              <div className="mt-1 border-t border-line pt-2">
                <Row label="Total" value={inr(totals.total)} bold />
              </div>
            </Card>
          </>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl border-t border-line bg-surface/98 p-3 backdrop-blur pb-safe">
        <Button
          variant="gold"
          size="lg"
          block
          loading={submitting}
          disabled={lines.length === 0}
          onClick={submit}
        >
          Place order · {inr(totals.total)}
        </Button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-0.5 text-sm">
      <span className={bold ? 'font-semibold text-ink' : 'text-muted'}>
        {label}
      </span>
      <span className={bold ? 'text-lg font-bold text-ink' : 'text-ink'}>
        {value}
      </span>
    </div>
  );
}
