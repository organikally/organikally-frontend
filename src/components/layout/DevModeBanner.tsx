import { hasNativeBridge } from '@/lib/bridge/client';

// When running in a plain browser (no Expo shell) we clearly mark dev-mode so a
// rep never mistakes the geolocation/<input capture> fallback for the real
// device pipeline. Hidden inside the native WebView.
export function DevModeBanner() {
  if (hasNativeBridge()) return null;
  return (
    <div className="bg-ink px-3 py-1 text-center text-[11px] font-semibold tracking-wide text-yellow">
      DEV MODE · browser fallback (no native camera/GPS/secure-store)
    </div>
  );
}
