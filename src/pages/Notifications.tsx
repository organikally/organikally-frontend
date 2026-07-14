import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import {
  EmptyState,
  ErrorState,
  SkeletonList,
} from '@/components/ui/Spinner';
import { BellIcon, CheckCheckIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { relativeTime } from '@/lib/format';
import {
  NOTIFICATIONS_ROUTE,
  notificationTarget,
} from '@/lib/notifications/deepLink';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/features/notifications/data';
import type { AppNotification } from '@/types/models';

export function Notifications() {
  const nav = useNavigate();
  const { data, isLoading, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const items = useMemo(() => {
    const list = data?.items ?? [];
    // Newest-first; tolerate an already-sorted or unsorted backend.
    return [...list].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [data]);

  const unread = data?.unread_count ?? 0;

  function open(n: AppNotification) {
    if (!n.read) markRead.mutate(n.id);
    // The resolver only ever returns a path the router can match; when a
    // notification has nothing addressable it resolves to this very screen, so
    // marking it read is the whole interaction — don't push a no-op history entry.
    const target = notificationTarget(n.data);
    if (target !== NOTIFICATIONS_ROUTE) nav(target);
  }

  return (
    <div>
      {/* No header action: "Mark all read" sits in the content area below, so the
          title stays readable at 320px (it used to truncate to "Notifica…"). */}
      <TopBar
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : 'All caught up'}
        back
        showBell={false}
        compactSync
      />

      {unread > 0 && (
        <div className="flex justify-end px-4 pt-4">
          <button
            type="button"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="tap inline-flex items-center gap-1.5 rounded-pill border border-line bg-paper px-3 py-1.5 text-sm font-semibold text-gold-ink transition-colors duration-200 ease-brand active:bg-surface disabled:opacity-50"
          >
            <CheckCheckIcon className="h-4 w-4 shrink-0" />
            <span>Mark all read</span>
          </button>
        </div>
      )}

      <div className="p-4">
        {isLoading ? (
          <SkeletonList rows={5} />
        ) : isError ? (
          <ErrorState
            body="Could not load notifications."
            onRetry={() => void refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<BellIcon className="h-10 w-10" />}
            title="No notifications yet"
            // Only the events the backend actually emits (app/services/notify.py):
            // outlet.onboarded, visit.flagged_check_in, order.*, inventory.low_stock,
            // receivable.overdue. No approvals, no route changes — don't promise them.
            body="Order updates, flagged check-ins, newly onboarded outlets, low stock and overdue payments show up here."
          />
        ) : (
          <ul className="space-y-2.5">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => open(n)}
                  className={cn(
                    'card w-full p-4 text-left transition-colors duration-200 ease-brand active:scale-[0.99] active:bg-surface',
                    !n.read && 'border-gold-ink/40 bg-yellow/5',
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className={cn(
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                        n.read ? 'bg-transparent' : 'bg-gold-ink',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p
                          className={cn(
                            'truncate text-sm text-ink',
                            !n.read && 'font-semibold',
                          )}
                        >
                          {n.title}
                        </p>
                        <span className="shrink-0 text-[11px] text-ink-faint">
                          {relativeTime(n.created_at)}
                        </span>
                      </div>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-3 text-sm text-ink-faint">
                          {n.body}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
