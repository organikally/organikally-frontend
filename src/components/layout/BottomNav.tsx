import { NavLink } from 'react-router-dom';
import {
  HomeIcon,
  RouteIcon,
  MapPinIcon,
  CartIcon,
  SyncIcon,
} from '@/components/ui/icons';
import { useSyncState } from '@/hooks/useSyncState';
import { cn } from '@/lib/cn';

const items = [
  { to: '/today', label: 'Today', Icon: HomeIcon },
  { to: '/outlets', label: 'Outlets', Icon: MapPinIcon },
  { to: '/route', label: 'Route', Icon: RouteIcon },
  { to: '/orders', label: 'Orders', Icon: CartIcon },
  { to: '/sync', label: 'Sync', Icon: SyncIcon },
];

export function BottomNav() {
  const { pending, errors } = useSyncState();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-xl">
        {items.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'relative tap flex h-nav flex-col items-center justify-center gap-0.5 text-[11px] font-semibold',
                  'transition-colors duration-200 ease-brand',
                  isActive ? 'text-ink' : 'text-ink-faint',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {/* active accent tick (gold-ink) */}
                  {isActive && (
                    <span className="absolute top-0 h-0.5 w-8 rounded-pill bg-gold-ink" />
                  )}
                  <span className="relative">
                    <Icon
                      className={cn(
                        'h-6 w-6',
                        isActive ? 'text-gold-ink stroke-2' : 'stroke-[1.5]',
                      )}
                    />
                    {to === '/sync' && (pending > 0 || errors > 0) && (
                      <span
                        className={cn(
                          'absolute -right-2 -top-1.5 min-w-[16px] rounded-pill px-1 text-[10px] leading-4 text-paper',
                          errors > 0 ? 'bg-danger' : 'bg-gold-ink',
                        )}
                      >
                        {errors > 0 ? errors : pending}
                      </span>
                    )}
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
