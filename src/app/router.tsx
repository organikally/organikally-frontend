import { Navigate, Outlet, createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from './RequireAuth';
import { ROUTE } from './routePaths';
import { useBridgeEvents } from '@/hooks/useBridgeEvents';
import { AppShell } from '@/components/layout/AppShell';
import { Login } from '@/pages/Login';
import { Privacy } from '@/pages/Privacy';
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
import { Notifications } from '@/pages/Notifications';

// Pathless root layout: mounts native-bridge event wiring (deep-link push +
// hardware back) inside the router so it has navigation available.
function RootLayout() {
  useBridgeEvents();
  return <Outlet />;
}

// Paths come from `routePaths.ts` — the same list the notification deep-link
// resolver validates against, so the two can never drift apart.
export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: ROUTE.login, element: <Login /> },
      // Public — reachable pre-auth from the Login footer and onboarding consent.
      { path: ROUTE.privacy, element: <Privacy /> },
      {
        element: <RequireAuth />,
        children: [
          // Full-screen flows (no bottom nav)
          { path: ROUTE.outletOnboard, element: <OnboardOutlet /> },
          { path: ROUTE.outletDetail, element: <OutletDetail /> },
          { path: ROUTE.outletCheckIn, element: <CheckIn /> },
          { path: ROUTE.visitPitch, element: <VisitPitch /> },
          { path: ROUTE.visitCatalog, element: <VisitCatalog /> },
          { path: ROUTE.visitOrder, element: <VisitOrder /> },
          { path: ROUTE.visitPayment, element: <VisitPayment /> },
          { path: ROUTE.visitOutcome, element: <VisitOutcome /> },
          { path: ROUTE.orderDetail, element: <OrderDetail /> },
          // Tabbed shell
          {
            element: <AppShell />,
            children: [
              { index: true, element: <Navigate to={ROUTE.today} replace /> },
              { path: ROUTE.today, element: <Today /> },
              { path: ROUTE.outlets, element: <Outlets /> },
              { path: ROUTE.routeView, element: <RouteView /> },
              { path: ROUTE.orders, element: <Orders /> },
              { path: ROUTE.notifications, element: <Notifications /> },
              { path: ROUTE.sync, element: <SyncStatus /> },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to={ROUTE.today} replace /> },
    ],
  },
]);
