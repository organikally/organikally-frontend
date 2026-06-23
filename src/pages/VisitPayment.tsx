import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/Spinner';
import { VisitStepper } from '@/components/domain/VisitStepper';
import { toast } from '@/components/ui/Toast';
import { useVisitFlow } from '@/stores/visitFlow';
import { useCatalog, computeCartTotals } from '@/features/catalog/data';
import { inr, addDaysIso, fmtDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  enqueuePayment,
  newClientUuid,
} from '@/lib/offline/mutations';
import type { PaymentMethod, PaymentType } from '@/types/enums';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_TYPE_LABELS,
} from '@/types/enums';
import type { PaymentCreateRequest } from '@/types/api';

// Payment-terms capture: type/method/amount/credit days → due date
// (CONTRACT §4 payments POST). Record-keeping only — no live gateway.
export function VisitPayment() {
  const nav = useNavigate();
  const active = useVisitFlow((s) => s.active);
  const setPaymentDraft = useVisitFlow((s) => s.setPayment);
  const { data: catalog } = useCatalog();

  const totals = useMemo(
    () => computeCartTotals(active?.cart ?? {}, catalog ?? []),
    [active?.cart, catalog],
  );
  const orderTotal = totals.total;

  const [type, setType] = useState<PaymentType>('credit');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amount, setAmount] = useState<number>(0);
  const [creditDays, setCreditDays] = useState<number>(15);
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!active)
    return (
      <div>
        <TopBar title="Payment" back />
        <EmptyState
          title="No active visit"
          action={<Button onClick={() => nav('/today')}>Go to today</Button>}
        />
      </div>
    );

  if (!active.orderClientUuid) {
    return (
      <div>
        <TopBar title="Payment" subtitle={active.outletName} back />
        <EmptyState
          title="No order to settle"
          body="Place an order first, or skip to outcome."
          action={
            <Button onClick={() => nav('/visit/outcome')}>Skip to outcome</Button>
          }
        />
      </div>
    );
  }

  const collected = type === 'full' ? orderTotal : type === 'credit' ? 0 : amount;
  const balance = Math.max(0, orderTotal - collected);
  const dueDate =
    balance > 0 && creditDays > 0 ? addDaysIso(creditDays) : null;

  async function submit() {
    if (type === 'partial' && (amount <= 0 || amount > orderTotal))
      return toast.error('Enter a valid partial amount');
    setSubmitting(true);
    try {
      const client_uuid = newClientUuid();
      const body: PaymentCreateRequest = {
        order_id: null,
        // Server resolves the real order id from its client_uuid during replay
        // (the order mutation precedes this payment in the queue).
        order_client_uuid: active!.orderClientUuid,
        type,
        method,
        amount_collected: collected,
        credit_days: balance > 0 ? creditDays : 0,
        reference: reference || undefined,
        client_uuid,
      };
      await enqueuePayment(body, { outlet_id: active!.outletId });
      setPaymentDraft({
        type,
        method,
        amount_collected: collected,
        credit_days: balance > 0 ? creditDays : 0,
        reference,
      });
      toast.success('Payment terms saved');
      nav('/visit/outcome');
    } catch (e) {
      toast.error((e as Error).message || 'Failed to save payment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pb-28">
      <TopBar title="Payment terms" subtitle={active.outletName} back />
      <div className="px-4">
        <VisitStepper current="Payment" />
      </div>

      <div className="space-y-3 p-4 pt-0">
        <Card className="bg-forest text-cream">
          <div className="flex items-center justify-between">
            <span className="text-cream/80">Order total</span>
            <span className="text-2xl font-bold">{inr(orderTotal)}</span>
          </div>
        </Card>

        <Card>
          <span className="field-label">Payment type</span>
          <div className="grid grid-cols-3 gap-2">
            {(['full', 'partial', 'credit'] as PaymentType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  'tap rounded-card border-2 px-2 py-2.5 text-sm font-semibold',
                  type === t
                    ? 'border-brand bg-brand/5 text-brand'
                    : 'border-line text-muted',
                )}
              >
                {PAYMENT_TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {type !== 'credit' && (
            <div className="mt-4">
              <Select
                label="Method"
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              >
                {(['cash', 'upi', 'cheque'] as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {type === 'partial' && (
            <div className="mt-4">
              <Input
                label="Amount collected (₹)"
                type="number"
                inputMode="decimal"
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
              />
            </div>
          )}

          {(type === 'credit' || balance > 0) && (
            <div className="mt-4">
              <Input
                label="Credit days"
                type="number"
                inputMode="numeric"
                value={creditDays}
                onChange={(e) => setCreditDays(Number(e.target.value) || 0)}
                hint={dueDate ? `Due ${fmtDate(dueDate)}` : undefined}
              />
            </div>
          )}

          {(method === 'cheque' || method === 'upi') && type !== 'credit' && (
            <div className="mt-4">
              <Input
                label={method === 'cheque' ? 'Cheque no.' : 'UPI ref.'}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          )}
        </Card>

        <Card>
          <Row label="Collected now" value={inr(collected)} />
          <Row label="Balance (credit)" value={inr(balance)} />
          {dueDate && <Row label="Due date" value={fmtDate(dueDate)} />}
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl border-t border-line bg-surface/98 p-3 backdrop-blur pb-safe">
        <Button
          variant="primary"
          size="lg"
          block
          loading={submitting}
          onClick={submit}
        >
          Save & continue
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}
