import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/Spinner';
import { VisitStepper } from '@/components/domain/VisitStepper';
import { toast } from '@/components/ui/Toast';
import { useVisitFlow } from '@/stores/visitFlow';
import { useConfig } from '@/hooks/useConfig';
import { enqueueCheckOut, enqueueOutcome } from '@/lib/offline/mutations';
import { bridge } from '@/lib/bridge/client';
import { latLngToPoint } from '@/lib/geo/geo';
import { addDaysIso } from '@/lib/format';
import { cn } from '@/lib/cn';
import { REASON_CODE_LABELS } from '@/types/enums';
import type { ReasonCode, VisitOutcome as Outcome } from '@/types/enums';
import { PackageIcon, CheckIcon } from '@/components/ui/icons';

export function VisitOutcome() {
  const nav = useNavigate();
  const config = useConfig();
  const active = useVisitFlow((s) => s.active);
  const clear = useVisitFlow((s) => s.clear);

  const hasOrder = !!active?.orderClientUuid;
  const [outcome, setOutcome] = useState<Outcome>(
    hasOrder ? 'order_placed' : 'no_order',
  );
  const [reason, setReason] = useState<ReasonCode | ''>('');
  const [nextDate, setNextDate] = useState(addDaysIso(7));
  const [submitting, setSubmitting] = useState(false);

  if (!active)
    return (
      <div>
        <TopBar title="Outcome" back />
        <EmptyState
          title="No active visit"
          action={<Button onClick={() => nav('/today')}>Go to today</Button>}
        />
      </div>
    );

  const reasonCodes = config.reason_codes?.length
    ? config.reason_codes
    : (Object.keys(REASON_CODE_LABELS) as ReasonCode[]);

  async function finish() {
    if (outcome === 'no_order' && !reason)
      return toast.error('Select a reason for no order');
    setSubmitting(true);
    try {
      // Check out: capture a GPS read (best-effort — null if it fails or is
      // denied) + timestamp and enqueue `visit.check_out` so the server can
      // compute `duration_min` (CONTRACT §3, §5.7, §7). Enqueued before the
      // outcome so it replays first in the created_at-ordered batch.
      const checkOutAt = new Date().toISOString();
      let checkOutLocation = null;
      try {
        const loc = await bridge.getLocation();
        checkOutLocation = latLngToPoint(loc.lat, loc.lng);
      } catch {
        // GPS unavailable/denied — record check-out without a location; the
        // server still computes duration from check-in → check-out time.
      }
      await enqueueCheckOut(active!.visitClientUuid, {
        location: checkOutLocation,
        timestamp: checkOutAt,
      });

      await enqueueOutcome(active!.visitClientUuid, {
        outcome,
        reason_code: outcome === 'no_order' ? (reason as ReasonCode) : null,
        next_visit_date: nextDate || null,
        // Link to the order by its client_uuid; the server resolves the real id
        // during batch replay (the order mutation precedes this one).
        order_client_uuid: active!.orderClientUuid ?? null,
        // Fold the pitch/demo log into the outcome (no standalone sync type).
        pitch: {
          demoed_sku_ids: active!.demoedSkuIds,
          notes: active!.pitchNotes || undefined,
          photos: [],
        },
      });
      // Pitch is folded into the outcome mutation server-side via the visit
      // client_uuid; check-out is its own mutation (above). The rep's flow ends
      // here.
      toast.success('Visit completed');
      clear();
      nav('/today', { replace: true });
    } catch (e) {
      toast.error((e as Error).message || 'Failed to complete visit');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pb-28">
      <TopBar title="Visit outcome" subtitle={active.outletName} back />
      <div className="px-4">
        <VisitStepper current="Outcome" />
      </div>

      <div className="space-y-3 p-4 pt-0">
        <Card>
          <span className="field-label">Outcome</span>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setOutcome('order_placed')}
              disabled={!hasOrder}
              className={cn(
                'tap flex flex-col items-center gap-1.5 rounded-card border-2 px-3 py-4 font-semibold disabled:opacity-40',
                outcome === 'order_placed'
                  ? 'border-success bg-success/5 text-success'
                  : 'border-line text-muted',
              )}
            >
              <PackageIcon className="h-6 w-6" />
              Order placed
            </button>
            <button
              onClick={() => setOutcome('no_order')}
              className={cn(
                'tap flex flex-col items-center gap-1.5 rounded-card border-2 px-3 py-4 font-semibold',
                outcome === 'no_order'
                  ? 'border-danger bg-danger/5 text-danger'
                  : 'border-line text-muted',
              )}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="m15 9-6 6M9 9l6 6" />
              </svg>
              No order
            </button>
          </div>
          {!hasOrder && (
            <p className="mt-2 text-xs text-muted">
              No order was placed in this visit. Add products from the catalog if
              the owner orders.
            </p>
          )}
        </Card>

        {outcome === 'no_order' && (
          <Card>
            <span className="field-label">Reason</span>
            <div className="grid grid-cols-2 gap-2">
              {reasonCodes.map((rc) => (
                <button
                  key={rc}
                  onClick={() => setReason(rc)}
                  className={cn(
                    'tap rounded-card border-2 px-2 py-2.5 text-sm font-semibold',
                    reason === rc
                      ? 'border-brand bg-brand/5 text-brand'
                      : 'border-line text-muted',
                  )}
                >
                  {REASON_CODE_LABELS[rc]}
                </button>
              ))}
            </div>
          </Card>
        )}

        <Card>
          <Input
            label="Next visit date"
            type="date"
            value={nextDate}
            onChange={(e) => setNextDate(e.target.value)}
            hint="Suggested date from cadence — adjust as needed."
          />
          <div className="mt-2 flex gap-2">
            {[3, 7, 14].map((d) => (
              <button
                key={d}
                onClick={() => setNextDate(addDaysIso(d))}
                className="pill tap bg-surface-2 text-muted"
              >
                +{d}d
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl border-t border-line bg-surface/98 p-3 backdrop-blur pb-safe">
        <Button
          variant="primary"
          size="lg"
          block
          loading={submitting}
          leftIcon={<CheckIcon className="h-5 w-5" />}
          onClick={finish}
        >
          Complete visit & check out
        </Button>
      </div>
    </div>
  );
}
