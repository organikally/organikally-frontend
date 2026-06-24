import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { EmptyState } from '@/components/ui/Spinner';
import { useSyncState } from '@/hooks/useSyncState';
import { syncEngine } from '@/lib/offline/sync';
import { listMutations, listPhotos } from '@/lib/offline/db';
import type { QueuedMutation, QueuedPhoto } from '@/lib/offline/db';
import { useSession } from '@/stores/session';
import { fmtDateTime, relativeTime } from '@/lib/format';
import {
  SyncIcon,
  CheckIcon,
  AlertIcon,
  WifiOffIcon,
  CameraIcon,
  LogoutIcon,
} from '@/components/ui/icons';
import { runBootstrap } from '@/lib/offline/bootstrap';
import { toast } from '@/components/ui/Toast';

const TYPE_LABELS: Record<string, string> = {
  'outlet.create': 'Onboard outlet',
  'visit.check_in': 'Check-in',
  'visit.check_out': 'Check-out',
  'visit.outcome': 'Visit outcome',
  'order.create': 'Order',
  'payment.create': 'Payment',
};

export function SyncStatus() {
  const nav = useNavigate();
  const state = useSyncState();
  const logout = useSession((s) => s.logout);
  const user = useSession((s) => s.user);
  const [muts, setMuts] = useState<QueuedMutation[]>([]);
  const [photos, setPhotos] = useState<QueuedPhoto[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setMuts(await listMutations());
    setPhotos(await listPhotos());
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [load]);

  async function refreshData() {
    setRefreshing(true);
    try {
      await runBootstrap();
      toast.success('Reference data refreshed');
    } catch {
      toast.error('Could not refresh (offline?)');
    } finally {
      setRefreshing(false);
    }
  }

  const pendingPhotos = photos.filter(
    (p) => p.status === 'pending' || p.status === 'uploading' || p.status === 'error',
  );

  return (
    <div>
      <TopBar title="Sync" showSync={false} />
      <div className="space-y-3 p-4">
        {/* Connection + queue summary */}
        <Card
          className={
            state.online
              ? state.errors
                ? 'border-danger/40'
                : 'border-success/40'
              : 'border-line'
          }
        >
          <div className="flex items-center gap-3">
            <div
              className={
                'flex h-11 w-11 items-center justify-center rounded-pill ' +
                (state.online ? 'bg-success/12 text-success' : 'bg-surface text-ink-faint')
              }
            >
              {!state.online ? (
                <WifiOffIcon className="h-6 w-6" />
              ) : state.syncing ? (
                <SyncIcon className="h-6 w-6 animate-spin" />
              ) : state.errors ? (
                <AlertIcon className="h-6 w-6 text-danger" />
              ) : (
                <CheckIcon className="h-6 w-6" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-ink">
                {!state.online
                  ? 'Offline'
                  : state.syncing
                    ? 'Syncing…'
                    : state.errors
                      ? `${state.errors} failed`
                      : state.pending
                        ? `${state.pending} queued`
                        : 'All synced'}
              </p>
              <p className="text-xs text-ink-faint">
                {state.lastSyncAt
                  ? `Last sync ${relativeTime(state.lastSyncAt)}`
                  : 'Not synced yet'}
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              variant="primary"
              size="sm"
              block
              loading={state.syncing}
              onClick={() => void syncEngine.sync()}
            >
              Sync now
            </Button>
            {state.errors > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="!border-danger !text-danger"
                onClick={() => void syncEngine.retryErrors()}
              >
                Retry failed
              </Button>
            )}
          </div>
          {state.lastError && (
            <p className="mt-2 text-xs text-danger">{state.lastError}</p>
          )}
        </Card>

        {/* Photo upload queue */}
        {photos.length > 0 && (
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 font-sans font-semibold text-ink">
                <CameraIcon className="h-5 w-5 text-gold-ink" /> Photos
              </h3>
              <span className="text-sm tnum text-ink-faint">
                {pendingPhotos.length} pending · {photos.length} total
              </span>
            </div>
            <p className="text-xs text-ink-faint">
              Live photos upload opportunistically; their mutation is held until
              the photo URL is ready.
            </p>
          </Card>
        )}

        {/* Outbound queue: hairline-grouped, no card-in-card (§4) */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Outbound queue</h2>
            <Button
              variant="ghost"
              size="sm"
              loading={refreshing}
              onClick={refreshData}
            >
              Refresh data
            </Button>
          </div>

          {muts.length === 0 ? (
            <EmptyState
              icon={<CheckIcon className="h-10 w-10" />}
              title="Queue is empty"
              body="All your visits and orders have synced."
            />
          ) : (
            <Card className="!p-0">
              <ul className="divide-y divide-line">
                {muts.map((m) => (
                  <li key={m.client_uuid} className="p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">
                          {m.label || TYPE_LABELS[m.type] || m.type}
                        </p>
                        <p className="text-xs tnum text-ink-faint">
                          {fmtDateTime(m.created_at)}
                          {m.attempts > 0 && ` · ${m.attempts} attempt(s)`}
                        </p>
                        {m.last_error && (
                          <p className="mt-1 text-xs text-danger">
                            {m.last_error}
                          </p>
                        )}
                      </div>
                      <QueuePill status={m.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        {/* Account */}
        <Card>
          <p className="text-sm font-semibold text-ink">{user?.name}</p>
          <p className="text-xs text-ink-faint">
            {user?.email} · {user?.role?.toUpperCase()}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 !border-danger !text-danger"
            leftIcon={<LogoutIcon className="h-4 w-4" />}
            onClick={async () => {
              await logout();
              nav('/login', { replace: true });
            }}
          >
            Sign out
          </Button>
        </Card>
      </div>
    </div>
  );
}

function QueuePill({ status }: { status: QueuedMutation['status'] }) {
  const map: Record<
    QueuedMutation['status'],
    { tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; label: string }
  > = {
    pending: { tone: 'warning', label: 'Queued' },
    syncing: { tone: 'info', label: 'Syncing' },
    synced: { tone: 'success', label: 'Synced' },
    duplicate: { tone: 'success', label: 'Synced' },
    error: { tone: 'danger', label: 'Failed' },
  };
  const { tone, label } = map[status];
  return <Pill tone={tone}>{label}</Pill>;
}
