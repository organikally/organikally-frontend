import { useNavigate } from 'react-router-dom';
import { ChevronLeftIcon } from '@/components/ui/icons';
import { SyncIndicator } from './SyncIndicator';
import { NotificationBell } from './NotificationBell';
import type { ReactNode } from 'react';

export function TopBar({
  title,
  subtitle,
  back,
  right,
  showSync = true,
  showBell = true,
  compactSync = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: boolean;
  right?: ReactNode;
  showSync?: boolean;
  // The header bell is shown by default; screens that already ARE the
  // notifications view (or want a clean header) opt out.
  showBell?: boolean;
  // Collapse the sync pill to its icon. For screens whose header carries a long
  // title and/or its own action — at 320px the pill's label ("Offline · 12
  // queued") would otherwise eat the title down to an ellipsis.
  compactSync?: boolean;
}) {
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
      <div className="flex items-center gap-2 px-3 py-2.5">
        {back && (
          <button
            onClick={() => nav(-1)}
            className="tap -ml-1 flex shrink-0 items-center justify-center rounded-pill text-ink transition-colors duration-200 ease-brand active:bg-surface"
            aria-label="Back"
          >
            <ChevronLeftIcon />
          </button>
        )}
        {/* Title owns all remaining width; the action cluster never grows into it. */}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl leading-tight text-ink">
            {title}
          </h1>
          {subtitle && (
            <p className="truncate text-xs text-ink-faint">{subtitle}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {right}
          {showBell && <NotificationBell />}
          {showSync && <SyncIndicator compact={compactSync} />}
        </div>
      </div>
    </header>
  );
}
