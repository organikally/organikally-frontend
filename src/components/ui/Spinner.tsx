import { cn } from '@/lib/cn';
import { AlertIcon } from '@/components/ui/icons';

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block h-5 w-5 animate-spin rounded-full border-2 border-gold-ink border-t-transparent',
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

export function FullScreenLoader({ label }: { label?: string }) {
  return (
    <div className="flex h-screen-safe flex-col items-center justify-center gap-3 text-ink-faint">
      <Spinner className="h-7 w-7" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}

// Skeleton loader matching layout (DESIGN_SYSTEM §4) — preferred over spinners on data surfaces.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4 w-full', className)} aria-hidden />;
}

// A list of card-shaped skeleton rows for data lists.
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" aria-busy aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card space-y-2.5 p-4">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-pill" />
            <Skeleton className="h-5 w-20 rounded-pill" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="text-ink-faint/50">{icon}</div>}
      <h3 className="font-sans text-base font-semibold text-ink">{title}</h3>
      {body && <p className="max-w-xs text-sm text-ink-faint">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// Inline / contextual error with retry (DESIGN_SYSTEM §4 — mandatory on data surfaces).
export function ErrorState({
  title = 'Something went wrong',
  body,
  onRetry,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="text-danger">
        <AlertIcon className="h-9 w-9" />
      </div>
      <h3 className="font-sans text-base font-semibold text-ink">{title}</h3>
      {body && <p className="max-w-xs text-sm text-ink-faint">{body}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn-outline mt-2 text-sm"
          type="button"
        >
          Try again
        </button>
      )}
    </div>
  );
}
