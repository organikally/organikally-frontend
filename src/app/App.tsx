import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './router';
import { ToastHost } from '@/components/ui/Toast';
import { useSession } from '@/stores/session';
import { useVisitFlow } from '@/stores/visitFlow';
import { syncEngine } from '@/lib/offline/sync';
import { registerServiceWorker } from '@/lib/offline/registerSW';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // Offline-first: never throw away cached data on error.
      gcTime: 1000 * 60 * 60 * 24,
    },
  },
});

export function App() {
  const restore = useSession((s) => s.restore);
  const hydrateVisit = useVisitFlow((s) => s.hydrate);

  useEffect(() => {
    // On token expiry the sync loop hands off here: tear down the session
    // (queue preserved) so RequireAuth routes to /login.
    syncEngine.onAuthError(() => {
      void useSession.getState().sessionExpired();
    });
    void restore();
    void hydrateVisit();
    syncEngine.start();
    void registerServiceWorker();
    return () => syncEngine.stop();
  }, [restore, hydrateVisit]);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ToastHost />
    </QueryClientProvider>
  );
}
