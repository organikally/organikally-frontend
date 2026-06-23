import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { DevModeBanner } from './DevModeBanner';

// App shell with bottom nav. Content scrolls; nav is fixed.
export function AppShell() {
  return (
    <div className="mx-auto flex min-h-screen-safe max-w-xl flex-col bg-surface">
      <DevModeBanner />
      <main className="flex-1 pb-[calc(var(--nav,64px)+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
