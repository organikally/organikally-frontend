import { Link } from 'react-router-dom';
import { useSyncState } from '@/hooks/useSyncState';
import { SyncIcon, WifiOffIcon, CheckIcon, AlertIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

// Persistent offline/sync indicator (CONTRACT §8). Tap to open the Sync screen.
export function SyncIndicator({ className }: { className?: string }) {
  const { online, syncing, pending, errors } = useSyncState();

  let tone = 'bg-success/12 text-success';
  let Icon = CheckIcon;
  let label = 'Synced';

  if (!online) {
    tone = 'bg-surface-2 text-muted';
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
    tone = 'bg-warning/15 text-[#8a6d12]';
    Icon = SyncIcon;
    label = `${pending} queued`;
  }

  return (
    <Link
      to="/sync"
      className={cn(
        'pill tap !px-2.5',
        tone,
        className,
      )}
      aria-label={`Sync status: ${label}`}
    >
      <Icon className={cn('h-4 w-4', syncing && 'animate-spin')} />
      <span className="text-xs font-semibold">{label}</span>
    </Link>
  );
}
