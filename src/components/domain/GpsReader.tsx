// Reads precise GPS via the bridge (native) or navigator.geolocation
// (browser), exposing accuracy + mock-location flag. Reused by onboarding
// (fixes geofence) and check-in (geo verification).

import { useCallback, useState } from 'react';
import { bridge } from '@/lib/bridge/client';
import type { LocationResult } from '@/lib/bridge/types';
import { Button } from '@/components/ui/Button';
import { MapPinIcon, AlertIcon } from '@/components/ui/icons';

export function useGpsReader() {
  const [reading, setReading] = useState<LocationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const read = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await bridge.getLocation();
      setReading(r);
      return r;
    } catch (e) {
      setError((e as Error).message || 'Location unavailable');
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  return { reading, busy, error, read, setReading };
}

export function GpsStatus({
  reading,
  busy,
  error,
  onRead,
  thresholdM,
}: {
  reading: LocationResult | null;
  busy: boolean;
  error: string | null;
  onRead: () => void;
  thresholdM: number;
}) {
  const accuracyBad = reading && reading.accuracy > thresholdM;
  return (
    <div className="rounded-card border border-line bg-paper p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPinIcon className="h-5 w-5 text-gold-ink" />
          <span className="font-semibold text-ink">Location</span>
        </div>
        <Button size="sm" variant="outline" onClick={onRead} loading={busy}>
          {reading ? 'Refresh' : 'Read GPS'}
        </Button>
      </div>
      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-danger">
          <AlertIcon className="h-4 w-4" /> {error}
        </p>
      )}
      {reading && (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <dt className="text-ink-faint">Lat</dt>
          <dd className="text-right tnum text-ink-muted">{reading.lat.toFixed(6)}</dd>
          <dt className="text-ink-faint">Lng</dt>
          <dd className="text-right tnum text-ink-muted">{reading.lng.toFixed(6)}</dd>
          <dt className="text-ink-faint">Accuracy</dt>
          <dd
            className={
              'text-right tnum ' +
              (accuracyBad ? 'text-danger font-semibold' : 'text-success')
            }
          >
            ±{Math.round(reading.accuracy)} m
          </dd>
          {reading.is_mock && (
            <>
              <dt className="text-ink-faint">Mock</dt>
              <dd className="text-right font-semibold text-danger">Detected</dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
