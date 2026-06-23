// Enums — mirror CONTRACT §2 exactly.

export type Role =
  | 'fsr'
  | 'asm'
  | 'regional_head'
  | 'warehouse_manager'
  | 'finance'
  | 'admin'
  | 'super_admin';

export type OutletStatus =
  | 'prospect'
  | 'pending_approval'
  | 'active'
  | 'dormant'
  | 'churned'
  | 'rejected';

export type OutletClass = 'A' | 'B' | 'C' | 'D';

export type OrderStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'allocated'
  | 'dispatched'
  | 'delivered'
  | 'invoiced'
  | 'cancelled';

export type ReceivableStatus = 'open' | 'partially_paid' | 'paid' | 'overdue';

export type PaymentType = 'full' | 'partial' | 'credit';

export type PaymentMethod = 'cash' | 'upi' | 'cheque';

export type VisitOutcome = 'order_placed' | 'no_order';

export type ReasonCode =
  | 'not_interested'
  | 'no_shelf_space'
  | 'decision_pending'
  | 'owner_absent'
  | 'shop_closed'
  | 'price_issue'
  | 'sufficient_stock'
  | 'other';

export type CreditAction = 'warn' | 'block' | 'require_approval';

export type CreditResult = 'ok' | 'warn' | 'block' | 'approval_required';

export type SchemeType = 'slab' | 'bogo' | 'free_goods' | 'flat';

// Human-friendly labels for the field UI.
export const REASON_CODE_LABELS: Record<ReasonCode, string> = {
  not_interested: 'Not interested',
  no_shelf_space: 'No shelf space',
  decision_pending: 'Decision pending',
  owner_absent: 'Owner absent',
  shop_closed: 'Shop closed',
  price_issue: 'Price issue',
  sufficient_stock: 'Sufficient stock',
  other: 'Other',
};

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  full: 'Full payment',
  partial: 'Partial payment',
  credit: 'On credit',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  cheque: 'Cheque',
};

export const OUTLET_STATUS_LABELS: Record<OutletStatus, string> = {
  prospect: 'Prospect',
  pending_approval: 'Pending approval',
  active: 'Active',
  dormant: 'Dormant',
  churned: 'Churned',
  rejected: 'Rejected',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  allocated: 'Allocated',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  invoiced: 'Invoiced',
  cancelled: 'Cancelled',
};
