import { Link } from 'react-router-dom';
import { useSyncState } from '@/hooks/useSyncState';
import { SyncIcon, WifiOffIcon, CheckIcon, AlertIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

// Persistent offline/sync indicator (CONTRACT §8). Tap to open the Sync screen.
//
// `compact` drops the text label (icon + tone still carry the state, and the
// label stays in the accessible name) so a header that also owns a screen title
// and an action still reads at 320px.
export function SyncIndicator({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { online, syncing, pending, errors } = useSyncState();

  let tone = 'bg-success/12 text-success';
  let Icon = CheckIcon;
  let label = 'Synced';

  if (!online) {
    tone = 'bg-surface text-ink-faint';
    Icon = WifiOffIcon;
    label = pending > 0 ? `Offline · ${pending} queued` : 'Offline';
  } else if (errors > 0) {
    tone = 'bg-danger/12 text-danger';
    Icon = AlertIcon;
    label = `${errors} failed`;
  } else if (syncing) {
    tone = 'bg-info/12 text-info';
    Icon = SyncIcon;
    label = 'Syncing…';
  } else if (pending > 0) {
    tone = 'bg-warning/12 text-warning';
    Icon = SyncIcon;
    label = `${pending} queued`;
  }

  return (
    <Link
      to="/sync"
      className={cn(
        'pill tap shrink-0',
        compact ? '!px-2' : '!px-2.5',
        tone,
        className,
      )}
      aria-label={`Sync status: ${label}`}
    >
      <Icon className={cn('h-4 w-4 shrink-0', syncing && 'animate-spin')} />
      <span className={cn('text-xs font-semibold', compact && 'sr-only')}>
        {label}
      </span>
    </Link>
  );
}
