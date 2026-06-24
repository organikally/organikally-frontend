import { cn } from '@/lib/cn';
import type {
  OrderStatus,
  OutletStatus,
  ReceivableStatus,
} from '@/types/enums';
import {
  ORDER_STATUS_LABELS,
  OUTLET_STATUS_LABELS,
} from '@/types/enums';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';

const toneClass: Record<Tone, string> = {
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/12 text-warning',
  danger: 'bg-danger/12 text-danger',
  info: 'bg-info/12 text-info',
  neutral: 'bg-surface text-ink-faint',
  brand: 'bg-yellow/20 text-gold-ink',
};

export function Pill({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return <span className={cn('pill', toneClass[tone], className)}>{children}</span>;
}

const outletTone: Record<OutletStatus, Tone> = {
  prospect: 'info',
  pending_approval: 'warning',
  active: 'success',
  dormant: 'neutral',
  churned: 'danger',
  rejected: 'danger',
};

export function OutletStatusPill({ status }: { status: OutletStatus }) {
  return <Pill tone={outletTone[status]}>{OUTLET_STATUS_LABELS[status]}</Pill>;
}

const orderTone: Record<OrderStatus, Tone> = {
  draft: 'neutral',
  submitted: 'info',
  approved: 'warning',
  allocated: 'info',
  dispatched: 'info',
  delivered: 'success',
  invoiced: 'success',
  cancelled: 'danger',
};

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  return <Pill tone={orderTone[status]}>{ORDER_STATUS_LABELS[status]}</Pill>;
}

const receivableTone: Record<ReceivableStatus, Tone> = {
  open: 'info',
  partially_paid: 'warning',
  paid: 'success',
  overdue: 'danger',
};
const receivableLabel: Record<ReceivableStatus, string> = {
  open: 'Open',
  partially_paid: 'Partial',
  paid: 'Paid',
  overdue: 'Overdue',
};

export function ReceivablePill({ status }: { status: ReceivableStatus }) {
  return <Pill tone={receivableTone[status]}>{receivableLabel[status]}</Pill>;
}

export function FencePill({ inFence }: { inFence: boolean }) {
  return (
    <Pill tone={inFence ? 'success' : 'danger'}>
      {inFence ? 'In fence' : 'Out of fence'}
    </Pill>
  );
}

export function ClassPill({ outletClass }: { outletClass: string }) {
  return <Pill tone="brand">Class {outletClass}</Pill>;
}
