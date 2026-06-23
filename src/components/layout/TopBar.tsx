import { useNavigate } from 'react-router-dom';
import { ChevronLeftIcon } from '@/components/ui/icons';
import { SyncIndicator } from './SyncIndicator';
import type { ReactNode } from 'react';

export function TopBar({
  title,
  subtitle,
  back,
  right,
  showSync = true,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: boolean;
  right?: ReactNode;
  showSync?: boolean;
}) {
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="flex items-center gap-2 px-3 py-2.5">
        {back && (
          <button
            onClick={() => nav(-1)}
            className="tap -ml-1 flex items-center justify-center rounded-pill text-ink active:bg-surface-2"
            aria-label="Back"
          >
            <ChevronLeftIcon />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold leading-tight text-ink">
            {title}
          </h1>
          {subtitle && (
            <p className="truncate text-xs text-muted">{subtitle}</p>
          )}
        </div>
        {right}
        {showSync && <SyncIndicator />}
      </div>
    </header>
  );
}
