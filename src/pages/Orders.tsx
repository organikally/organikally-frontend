import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { OrderStatusPill, Pill } from '@/components/ui/Pill';
import { EmptyState, Spinner } from '@/components/ui/Spinner';
import { useOrders } from '@/features/order/data';
import { useOutlets } from '@/features/outlet/data';
import { inr, fmtDateTime } from '@/lib/format';
import { CartIcon, ChevronRightIcon } from '@/components/ui/icons';

export function Orders() {
  const nav = useNavigate();
  const { data: orders, isLoading } = useOrders();
  const { data: outlets } = useOutlets();
  const outletName = (id: string) =>
    outlets?.find((o) => o.id === id)?.name ?? 'Outlet';

  return (
    <div>
      <TopBar title="Orders" subtitle={`${orders?.length ?? 0} total`} />
      <div className="space-y-2.5 p-4">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : !orders || orders.length === 0 ? (
          <EmptyState
            icon={<CartIcon className="h-10 w-10" />}
            title="No orders yet"
            body="Orders you place during visits appear here."
          />
        ) : (
          orders.map((o) => {
            const isLocal = o.id.startsWith('local:');
            return (
              <Card
                key={o.id}
                onPress={() => nav(`/orders/${o.id}`)}
                className="!p-3.5"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold text-ink">
                        {isLocal ? 'Queued order' : o.code}
                      </h3>
                    </div>
                    <p className="truncate text-xs text-muted">
                      {outletName(o.outlet_id)} · {fmtDateTime(o.created_at)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <OrderStatusPill status={o.status} />
                      {isLocal && <Pill tone="warning">Not synced</Pill>}
                      {o.credit_check?.result === 'block' && (
                        <Pill tone="danger">Credit blocked</Pill>
                      )}
                      {o.credit_check?.result === 'warn' && (
                        <Pill tone="warning">Credit warn</Pill>
                      )}
                      <span className="text-xs text-muted">
                        {o.line_items.length} items
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-ink">{inr(o.total)}</p>
                    <ChevronRightIcon className="ml-auto mt-1 h-5 w-5 text-line" />
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
