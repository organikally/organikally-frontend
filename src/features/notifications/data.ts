// Notifications server-state (TanStack Query).
//
// One shared query drives both the header bell badge (unread_count) and the
// Notifications screen (items). Polls every ~60s and refetches on window/app
// focus. Online-only: a 404 (backend not shipped yet) degrades to an empty
// list rather than an error, and offline the last-fetched cache is retained.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api/client';
import { useSession } from '@/stores/session';
import type { NotificationListResponse } from '@/types/api';

export const NOTIFICATIONS_KEY = ['notifications'] as const;

const EMPTY: NotificationListResponse = { items: [], unread_count: 0 };
const FETCH_LIMIT = 50;

async function fetchNotifications(): Promise<NotificationListResponse> {
  try {
    return await api.notifications({ limit: FETCH_LIMIT });
  } catch (e) {
    // Backend endpoint not live yet → behave as "no notifications".
    if (e instanceof ApiError && e.status === 404) return EMPTY;
    throw e; // network/other errors surface so the screen can show retry
  }
}

export function useNotifications() {
  const token = useSession((s) => s.token);
  return useQuery<NotificationListResponse>({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: fetchNotifications,
    enabled: !!token,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

// Imperative refetch (e.g. from the native app.state=active bridge event).
export function invalidateNotifications(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
}

function applyOneRead(
  prev: NotificationListResponse,
  id: string,
): NotificationListResponse {
  let removedUnread = 0;
  const items = prev.items.map((n) => {
    if (n.id === id && !n.read) {
      removedUnread += 1;
      return { ...n, read: true };
    }
    return n;
  });
  return {
    items,
    unread_count: Math.max(0, prev.unread_count - removedUnread),
  };
}

function applyAllRead(prev: NotificationListResponse): NotificationListResponse {
  return {
    items: prev.items.map((n) => (n.read ? n : { ...n, read: true })),
    unread_count: 0,
  };
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation<void, unknown, string, { prev?: NotificationListResponse }>({
    mutationFn: (id) => api.markNotificationRead(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      const prev = qc.getQueryData<NotificationListResponse>(NOTIFICATIONS_KEY);
      if (prev)
        qc.setQueryData<NotificationListResponse>(
          NOTIFICATIONS_KEY,
          applyOneRead(prev, id),
        );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(NOTIFICATIONS_KEY, ctx.prev);
    },
    onSettled: () => invalidateNotifications(qc),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation<void, unknown, void, { prev?: NotificationListResponse }>({
    mutationFn: () => api.markAllNotificationsRead(),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      const prev = qc.getQueryData<NotificationListResponse>(NOTIFICATIONS_KEY);
      if (prev)
        qc.setQueryData<NotificationListResponse>(
          NOTIFICATIONS_KEY,
          applyAllRead(prev),
        );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(NOTIFICATIONS_KEY, ctx.prev);
    },
    onSettled: () => invalidateNotifications(qc),
  });
}
