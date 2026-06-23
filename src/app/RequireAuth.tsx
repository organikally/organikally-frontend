import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '@/stores/session';
import { FullScreenLoader } from '@/components/ui/Spinner';

export function RequireAuth() {
  const { user, ready } = useSession();
  const loc = useLocation();
  if (!ready) return <FullScreenLoader label="Loading…" />;
  if (!user)
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <Outlet />;
}
