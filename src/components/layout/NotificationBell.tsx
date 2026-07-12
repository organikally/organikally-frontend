import { useNavigate } from 'react-router-dom';
import { BellIcon } from '@/components/ui/icons';
import { useNotifications } from '@/features/notifications/data';
import { useSession } from '@/stores/session';

// Header bell with an unread-count badge. Sourced from the shared notifications
// query (unread_count), which polls on focus + ~60s. Renders nothing pre-auth.
export function NotificationBell() {
  const nav = useNavigate();
  const token = useSession((s) => s.token);
  const { data } = useNotifications();
  const count = data?.unread_count ?? 0;

  if (!token) return null;

  return (
    <button
      type="button"
      onClick={() => nav('/notifications')}
      aria-label={
        count > 0 ? `Notifications, ${count} unread` : 'Notifications'
      }
      className="tap relative -mr-0.5 flex items-center justify-center rounded-pill text-ink transition-colors duration-200 ease-brand active:bg-surface"
    >
      <BellIcon className="h-6 w-6" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-[16px] rounded-pill bg-danger px-1 text-center text-[10px] font-semibold leading-4 text-paper">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}
