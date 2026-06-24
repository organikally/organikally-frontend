import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CameraCapture } from '@/components/domain/CameraCapture';
import { GpsStatus, useGpsReader } from '@/components/domain/GpsReader';
import { FullScreenLoader, EmptyState } from '@/components/ui/Spinner';
import { FencePill, Pill } from '@/components/ui/Pill';
import { toast } from '@/components/ui/Toast';
import { useOutlet } from '@/features/outlet/data';
import { useConfig } from '@/hooks/useConfig';
import { useSession } from '@/stores/session';
import { useVisitFlow } from '@/stores/visitFlow';
import { evaluateGeofence, formatDistance } from '@/lib/geo/geo';
import {
  dataUrlToBlob,
  enqueueCheckIn,
  newClientUuid,
  queuePhoto,
} from '@/lib/offline/mutations';
import { AlertIcon, CheckIcon } from '@/components/ui/icons';
import type { CheckInRequest } from '@/types/api';
import { latLngToPoint } from '@/lib/geo/geo';

export function CheckIn() {
  const { id } = useParams();
  const nav = useNavigate();
  const config = useConfig();
  const user = useSession((s) => s.user);
  const startVisit = useVisitFlow((s) => s.start);
  const { data: outlet, isLoading } = useOutlet(id);
  const gps = useGpsReader();
  const [photo, setPhoto] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // auto-read GPS on mount
  useEffect(() => {
    void gps.read();
  }, [gps.read]);

  const evalResult = useMemo(() => {
    if (!outlet || !gps.reading) return null;
    return evaluateGeofence(outlet.location, gps.reading, {
      geofenceRadiusM:
        outlet.geofence_radius_m ?? config.geofence_radius_m,
      gpsAccuracyThresholdM: config.gps_accuracy_threshold_m,
    });
  }, [outlet, gps.reading, config]);

  if (isLoading) return <FullScreenLoader label="Loading outlet" />;
  if (!outlet)
    return (
      <div>
        <TopBar title="Check-in" back />
        <EmptyState title="Outlet not found" />
      </div>
    );

  const needsFlag = evalResult ? !evalResult.clean : false;

  async function submit() {
    if (!gps.reading) return toast.error('Read GPS first');
    if (!photo) return toast.error('Live photo is required to check in');
    if (needsFlag && !flagReason.trim())
      return toast.error('A reason is required for an out-of-fence check-in');

    setSubmitting(true);
    try {
      const client_uuid = newClientUuid();
      const blob = await dataUrlToBlob(photo);
      const photoToken = await queuePhoto(blob, 'visit');

      const body: CheckInRequest = {
        outlet_id: outlet!.id,
        location: latLngToPoint(gps.reading.lat, gps.reading.lng),
        accuracy: gps.reading.accuracy,
        photo_url: photoToken,
        is_mock: gps.reading.is_mock,
        flag_reason: needsFlag ? flagReason.trim() : null,
        route_id: null,
        client_uuid,
      };

      await enqueueCheckIn(body, {
        outlet_id: outlet!.id,
        rep_id: user?.id ?? '',
      });

      // Start the in-app visit flow keyed by this check-in's client_uuid.
      startVisit({
        visitClientUuid: client_uuid,
        outletId: outlet!.id,
        outletName: outlet!.name,
        startedAt: new Date().toISOString(),
        inFence: !needsFlag,
      });

      toast.success('Checked in');
      nav(`/visit/pitch`, { replace: true });
    } catch (e) {
      toast.error((e as Error).message || 'Check-in failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pb-28">
      <TopBar title="Check in" subtitle={outlet.name} back />
      <div className="space-y-4 p-4">
        <GpsStatus
          reading={gps.reading}
          busy={gps.busy}
          error={gps.error}
          onRead={() => void gps.read()}
          thresholdM={config.gps_accuracy_threshold_m}
        />

        {evalResult && (
          <Card
            className={
              evalResult.clean
                ? 'border-success/40 bg-success/5'
                : 'border-danger/40 bg-danger/5'
            }
          >
            <div className="flex items-center justify-between">
              <FencePill inFence={evalResult.in_fence} />
              <span className="text-sm font-semibold text-ink">
                {formatDistance(evalResult.distance_m)} from shop
              </span>
            </div>
            {evalResult.flags.length > 0 && (
              <ul className="mt-2 space-y-1">
                {evalResult.flags.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-1.5 text-sm text-danger"
                  >
                    <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            )}
            {evalResult.clean && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-success">
                <CheckIcon className="h-4 w-4" /> Verified. You're at the shop.
              </p>
            )}
          </Card>
        )}

        <CameraCapture
          value={photo}
          onCapture={setPhoto}
          label="Live photo at shop *"
        />

        {needsFlag && (
          <Card className="border-danger/40">
            <div className="mb-1 flex items-center gap-1.5">
              <Pill tone="danger">Flag required</Pill>
            </div>
            <Input
              label="Reason for out-of-fence / flagged check-in"
              required
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              placeholder="e.g. shop moved, parked across road, GPS drift"
            />
            <p className="mt-1 text-xs text-ink-faint">
              This check-in will be recorded and surfaced to your ASM.
            </p>
          </Card>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl border-t border-line bg-surface/98 p-3 backdrop-blur pb-safe">
        <Button
          variant={needsFlag ? 'gold' : 'primary'}
          size="lg"
          block
          loading={submitting}
          leftIcon={<CheckIcon className="h-5 w-5" />}
          onClick={submit}
        >
          {needsFlag ? 'Check in with flag' : 'Check in'}
        </Button>
      </div>
    </div>
  );
}
