import { useParams } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { OrderStatusPill, Pill } from '@/components/ui/Pill';
import { FullScreenLoader, EmptyState, ErrorState } from '@/components/ui/Spinner';
import { useOrder } from '@/features/order/data';
import { inr, fmtDate, fmtDateTime } from '@/lib/format';

export function OrderDetail() {
  const { id } = useParams();
  const { data: order, isLoading, isError, refetch } = useOrder(id);

  if (isLoading) return <FullScreenLoader label="Loading order" />;
  if (isError)
    return (
      <div>
        <TopBar title="Order" back />
        <ErrorState
          body="Could not load this order."
          onRetry={() => void refetch()}
        />
      </div>
    );
  if (!order)
    return (
      <div>
        <TopBar title="Order" back />
        <EmptyState title="Order not found" />
      </div>
    );

  const isLocal = order.id.startsWith('local:');

  return (
    <div className="pb-8">
      <TopBar title={isLocal ? 'Queued order' : order.code} back />
      <div className="space-y-3 p-4">
        <Card>
          <div className="flex flex-wrap items-center gap-1.5">
            <OrderStatusPill status={order.status} />
            {isLocal && <Pill tone="warning">Not yet synced</Pill>}
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            Created {fmtDateTime(order.created_at)}
          </p>
          {order.expected_delivery_date && (
            <p className="text-sm text-ink-muted">
              Expected delivery {fmtDate(order.expected_delivery_date)}
            </p>
          )}
        </Card>

        {order.credit_check && (
          <Card
            className={
              order.credit_check.result === 'ok'
                ? 'border-success/40'
                : 'border-warning/40'
            }
          >
            <h2 className="mb-2 font-display text-lg text-ink">Credit check</h2>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-ink-faint">Limit</dt>
              <dd className="text-right tnum text-ink">
                {inr(order.credit_check.limit)}
              </dd>
              <dt className="text-ink-faint">Outstanding</dt>
              <dd className="text-right tnum text-ink">
                {inr(order.credit_check.outstanding)}
              </dd>
              <dt className="text-ink-faint">Result</dt>
              <dd className="text-right font-semibold capitalize text-ink">
                {order.credit_check.result.replace('_', ' ')}
              </dd>
            </dl>
          </Card>
        )}

        <Card className="!p-0">
          <h2 className="px-4 pt-4 font-display text-lg text-ink">Items</h2>
          <ul className="mt-2 divide-y divide-line">
            {order.line_items.map((li, i) => (
              <li
                key={`${li.sku_id}-${i}`}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{li.sku_name}</p>
                  <p className="text-xs tnum text-ink-faint">
                    {li.qty} × {inr(li.unit_price)}
                    {li.discount_pct > 0 && ` · -${li.discount_pct}%`}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tnum text-ink">
                  {inr(li.line_total)}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <Row label="Subtotal" value={inr(order.subtotal)} />
          <Row label="Discount" value={`- ${inr(order.discount_total)}`} />
          <Row label="GST" value={inr(order.gst_total)} />
          <div className="mt-1 border-t border-line pt-2">
            <Row label="Total" value={inr(order.total)} bold />
          </div>
        </Card>

        {order.status_history.length > 0 && (
          <Card className="!p-0">
            <h2 className="px-4 pt-4 font-display text-lg text-ink">History</h2>
            <ol className="mt-2 divide-y divide-line">
              {order.status_history.map((h, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <OrderStatusPill status={h.status} />
                  <span className="tnum text-ink-faint">{fmtDateTime(h.at)}</span>
                </li>
              ))}
            </ol>
          </Card>
        )}
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
      <span className={bold ? 'font-semibold text-ink' : 'text-ink-faint'}>
        {label}
      </span>
      <span
        className={
          'tnum ' + (bold ? 'text-lg font-bold text-ink' : 'text-ink')
        }
      >
        {value}
      </span>
    </div>
  );
}
