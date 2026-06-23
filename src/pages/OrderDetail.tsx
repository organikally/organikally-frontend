import { useParams } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { OrderStatusPill, Pill } from '@/components/ui/Pill';
import { FullScreenLoader, EmptyState } from '@/components/ui/Spinner';
import { useOrder } from '@/features/order/data';
import { inr, fmtDate, fmtDateTime } from '@/lib/format';

export function OrderDetail() {
  const { id } = useParams();
  const { data: order, isLoading } = useOrder(id);

  if (isLoading) return <FullScreenLoader label="Loading order" />;
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
          <p className="mt-2 text-sm text-muted">
            Created {fmtDateTime(order.created_at)}
          </p>
          {order.expected_delivery_date && (
            <p className="text-sm text-muted">
              Expected delivery {fmtDate(order.expected_delivery_date)}
            </p>
          )}
        </Card>

        {order.credit_check && (
          <Card
            className={
              order.credit_check.result === 'ok'
                ? 'border-success/40'
                : 'border-warning/50'
            }
          >
            <h3 className="mb-1 font-semibold text-ink">Credit check</h3>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <span className="text-muted">Limit</span>
              <span className="text-right">{inr(order.credit_check.limit)}</span>
              <span className="text-muted">Outstanding</span>
              <span className="text-right">
                {inr(order.credit_check.outstanding)}
              </span>
              <span className="text-muted">Result</span>
              <span className="text-right font-semibold capitalize">
                {order.credit_check.result.replace('_', ' ')}
              </span>
            </div>
          </Card>
        )}

        <Card>
          <h3 className="mb-2 font-semibold text-ink">Items</h3>
          <div className="space-y-2">
            {order.line_items.map((li, i) => (
              <div
                key={`${li.sku_id}-${i}`}
                className="flex items-center justify-between border-b border-line pb-2 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{li.sku_name}</p>
                  <p className="text-xs text-muted">
                    {li.qty} × {inr(li.unit_price)}
                    {li.discount_pct > 0 && ` · -${li.discount_pct}%`}
                  </p>
                </div>
                <span className="font-semibold text-ink">
                  {inr(li.line_total)}
                </span>
              </div>
            ))}
          </div>
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
          <Card>
            <h3 className="mb-2 font-semibold text-ink">History</h3>
            <ol className="space-y-2">
              {order.status_history.map((h, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <OrderStatusPill status={h.status} />
                  <span className="text-muted">{fmtDateTime(h.at)}</span>
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
      <span className={bold ? 'font-semibold text-ink' : 'text-muted'}>
        {label}
      </span>
      <span className={bold ? 'text-lg font-bold text-ink' : 'text-ink'}>
        {value}
      </span>
    </div>
  );
}
