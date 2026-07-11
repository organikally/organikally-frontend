import { Navigate, Outlet, createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from './RequireAuth';
import { useBridgeEvents } from '@/hooks/useBridgeEvents';
import { AppShell } from '@/components/layout/AppShell';
import { Login } from '@/pages/Login';
import { Today } from '@/pages/Today';
import { Outlets } from '@/pages/Outlets';
import { RouteView } from '@/pages/RouteView';
import { OutletDetail } from '@/pages/OutletDetail';
import { OnboardOutlet } from '@/pages/OnboardOutlet';
import { CheckIn } from '@/pages/CheckIn';
import { VisitPitch } from '@/pages/VisitPitch';
import { VisitCatalog } from '@/pages/VisitCatalog';
import { VisitOrder } from '@/pages/VisitOrder';
import { VisitPayment } from '@/pages/VisitPayment';
import { VisitOutcome } from '@/pages/VisitOutcome';
import { Orders } from '@/pages/Orders';
import { OrderDetail } from '@/pages/OrderDetail';
import { SyncStatus } from '@/pages/SyncStatus';

// Pathless root layout: mounts native-bridge event wiring (deep-link push +
// hardware back) inside the router so it has navigation available.
function RootLayout() {
  useBridgeEvents();
  return <Outlet />;
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/login', element: <Login /> },
      {
        element: <RequireAuth />,
        children: [
      // Full-screen flows (no bottom nav)
      { path: '/outlets/onboard', element: <OnboardOutlet /> },
      { path: '/outlets/:id', element: <OutletDetail /> },
      { path: '/outlets/:id/check-in', element: <CheckIn /> },
      { path: '/visit/pitch', element: <VisitPitch /> },
      { path: '/visit/catalog', element: <VisitCatalog /> },
      { path: '/visit/order', element: <VisitOrder /> },
      { path: '/visit/payment', element: <VisitPayment /> },
      { path: '/visit/outcome', element: <VisitOutcome /> },
          { path: '/orders/:id', element: <OrderDetail /> },
          // Tabbed shell
          {
            element: <AppShell />,
            children: [
              { index: true, element: <Navigate to="/today" replace /> },
              { path: '/today', element: <Today /> },
              { path: '/outlets', element: <Outlets /> },
              { path: '/route', element: <RouteView /> },
              { path: '/orders', element: <Orders /> },
              { path: '/sync', element: <SyncStatus /> },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/today" replace /> },
    ],
  },
]);
