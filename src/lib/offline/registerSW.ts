// Registers the service worker (via vite-plugin-pwa virtual module) and wires
// the SW->page "drain the queue" message + Background Sync registration.

import { syncEngine } from './sync';

export async function registerServiceWorker(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  try {
    const { registerSW } = await import('virtual:pwa-register');
    registerSW({ immediate: true });
  } catch {
    // dev/no-PWA build — ignore
  }

  // SW asks the page to drain the queue on reconnect.
  navigator.serviceWorker.addEventListener('message', (event) => {
    if ((event.data as { type?: string })?.type === 'SYNC_NOW') {
      void syncEngine.sync();
    }
  });

  // Request a one-off Background Sync so the OS can wake us to flush.
  try {
    const reg = await navigator.serviceWorker.ready;
    const sync = (reg as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    }).sync;
    if (sync) await sync.register('organikaly-sync').catch(() => {});
  } catch {
    /* unsupported — periodic timer + online event cover it */
  }
}
