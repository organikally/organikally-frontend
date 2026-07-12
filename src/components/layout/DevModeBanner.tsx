import { hasNativeBridge } from '@/lib/bridge/client';

// Marks browser-fallback mode (geolocation/<input capture> instead of the real
// device pipeline) so a developer doesn't mistake it for native. Shown only in
// local dev builds — never on the deployed production site — and always hidden
// inside the native WebView.
export function DevModeBanner() {
  if (!import.meta.env.DEV) return null;
  if (hasNativeBridge()) return null;
  return (
    <div className="bg-ink px-3 py-1 text-center text-[11px] font-semibold tracking-wide text-yellow">
      DEV MODE · browser fallback (no native camera/GPS/secure-store)
    </div>
  );
}
