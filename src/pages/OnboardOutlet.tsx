import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Pill } from '@/components/ui/Pill';
import { CameraCapture } from '@/components/domain/CameraCapture';
import { GpsStatus, useGpsReader } from '@/components/domain/GpsReader';
import { AlertIcon } from '@/components/ui/icons';
import { toast } from '@/components/ui/Toast';
import { useConfig } from '@/hooks/useConfig';
import { useSession } from '@/stores/session';
import { useVisitFlow } from '@/stores/visitFlow';
import { api } from '@/lib/api/client';
import { latLngToPoint, formatDistance } from '@/lib/geo/geo';
import {
  dataUrlToBlob,
  enqueueCheckIn,
  enqueueOutletCreate,
  newClientUuid,
  queuePhoto,
} from '@/lib/offline/mutations';
import type {
  CheckInRequest,
  DedupeCandidate,
  OutletCreateRequest,
} from '@/types/api';
import type { OutletProfile } from '@/types/models';

// First-visit onboarding for the area model: live shop photo + name + GPS
// (fixes the geofence centre) + profile fields → the outlet is added instantly
// (active, no approval), the onboarding doubles as the first check-in, and the
// rep drops straight into the catalog to take the first order.

const MATCH_LABELS: Record<DedupeCandidate['match'], string> = {
  phone: 'Same phone',
  gstin: 'Same GST',
  name: 'Similar name',
  proximity: 'Nearby',
};

function matchTone(
  m: DedupeCandidate['match'],
): 'danger' | 'warning' | 'info' {
  if (m === 'phone' || m === 'gstin') return 'danger';
  if (m === 'name') return 'warning';
  return 'info';
}

export function OnboardOutlet() {
  const nav = useNavigate();
  const config = useConfig();
  const user = useSession((s) => s.user);
  const startVisit = useVisitFlow((s) => s.start);
  const gps = useGpsReader();

  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [profile, setProfile] = useState<OutletProfile>({
    shop_type: '',
    owner_name: '',
    owner_phone: '',
    gst: '',
    refrigeration: false,
    shelf_space: '',
    competitor_brands: '',
    preferred_order_day: '',
  });
  const [outletClass, setOutletClass] = useState('C');
  const [submitting, setSubmitting] = useState(false);

  // De-dupe: warn (non-blocking) about a shop that may already exist.
  const [candidates, setCandidates] = useState<DedupeCandidate[]>([]);
  const [dupConfirmed, setDupConfirmed] = useState(false);
  const exactMatches = candidates.filter(
    (c) => c.match === 'phone' || c.match === 'gstin',
  );
  const hasExact = exactMatches.length > 0;

  function setP<K extends keyof OutletProfile>(k: K, v: OutletProfile[K]) {
    setProfile((prev) => ({ ...prev, [k]: v }));
  }

  // Debounced de-dupe lookup once the rep has a GPS fix and/or phone/gstin/name.
  // Any edit re-arms the exact-match confirmation. Fails silent offline (the
  // server hard-de-dupes by phone/gstin as a backstop on replay).
  const phone = profile.owner_phone?.trim() ?? '';
  const gstin = profile.gst?.trim() ?? '';
  useEffect(() => {
    setDupConfirmed(false);
    const near = gps.reading
      ? `${gps.reading.lng},${gps.reading.lat}`
      : undefined;
    const nm = name.trim();
    const enough =
      !!near || phone.length >= 6 || gstin.length >= 3 || nm.length >= 3;
    if (!enough) {
      setCandidates([]);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const res = await api.dedupeOutlets({
          near,
          phone: phone || undefined,
          gstin: gstin || undefined,
          name: nm || undefined,
        });
        if (alive) setCandidates(res.items ?? []);
      } catch {
        if (alive) setCandidates([]);
      }
    }, 600);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [gps.reading, phone, gstin, name]);

  // Service an already-existing outlet: geo-verified check-in → its order flow,
  // instead of creating a duplicate.
  function openExisting(c: DedupeCandidate) {
    nav(`/outlets/${c.id}/check-in`);
  }

  function validate(): boolean {
    if (!name.trim()) {
      toast.error('Shop name is required');
      return false;
    }
    if (!photo) {
      toast.error('Live shop photo is required');
      return false;
    }
    if (!gps.reading) {
      toast.error('Read GPS to fix the outlet location');
      return false;
    }
    return true;
  }

  async function create() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const client_uuid = newClientUuid();
      // One live capture serves both the outlet record and the check-in.
      const blob = await dataUrlToBlob(photo!);
      const outletPhotoToken = await queuePhoto(blob, 'outlet');
      const visitPhotoToken = await queuePhoto(blob, 'visit');

      const point = latLngToPoint(gps.reading!.lat, gps.reading!.lng);
      const body: OutletCreateRequest = {
        name: name.trim(),
        location: point,
        photos: [outletPhotoToken],
        profile,
        outlet_class: outletClass,
        territory_id: user?.territory_ids?.[0] ?? null,
        client_uuid,
      };
      await enqueueOutletCreate(body, {
        name: name.trim(),
        outlet_class: outletClass as never,
        status: 'active',
        credit_limit: config.new_outlet_credit_limit ?? 5000,
        assigned_rep_id: user?.id ?? null,
        created_by: user?.id ?? null,
      });

      // The onboarding GPS IS the new outlet's geofence centre, so the rep is
      // in-fence by construction. Treat onboarding as the first check-in and go
      // straight to selling — everything reconciles server-side by client_uuid.
      const outletId = `local:${client_uuid}`;
      const checkInUuid = newClientUuid();
      const checkInBody: CheckInRequest = {
        outlet_id: outletId,
        outlet_client_uuid: client_uuid,
        location: point,
        accuracy: gps.reading!.accuracy,
        photo_url: visitPhotoToken,
        is_mock: gps.reading!.is_mock,
        flag_reason: null,
        route_id: null,
        client_uuid: checkInUuid,
      };
      await enqueueCheckIn(checkInBody, {
        outlet_id: outletId,
        rep_id: user?.id ?? '',
      });

      startVisit({
        visitClientUuid: checkInUuid,
        outletId,
        outletName: name.trim(),
        startedAt: new Date().toISOString(),
        inFence: true,
      });

      toast.success('Outlet added');
      nav('/visit/catalog', { replace: true });
    } catch (e) {
      toast.error((e as Error).message || 'Failed to add outlet');
    } finally {
      setSubmitting(false);
    }
  }

  function submit() {
    if (!validate()) return;
    // Exact phone/gstin match → make the rep confirm before creating.
    if (hasExact && !dupConfirmed)
      return toast.error('This shop may already exist — confirm below');
    void create();
  }

  return (
    <div className="pb-28">
      <TopBar title="Onboard outlet" back />
      <div className="space-y-4 p-4">
        <CameraCapture
          value={photo}
          onCapture={setPhoto}
          label="Shop front (live photo) *"
          kind="outlet"
        />

        {candidates.length > 0 && (
          <Card className="border-warning/40 bg-warning/5">
            <div className="flex items-start gap-2">
              <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-ink">
                  This shop may already exist
                </h3>
                <p className="text-sm text-ink-faint">
                  {hasExact
                    ? 'An exact phone/GST match was found. Open the existing shop, or add anyway if it is genuinely different.'
                    : 'A nearby or similar shop is already on record. Open it to take an order instead of adding a duplicate.'}
                </p>
              </div>
            </div>
            <ul className="mt-3 space-y-2">
              {candidates.slice(0, 4).map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-card border border-line bg-paper p-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{c.name}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-faint">
                      <Pill tone={matchTone(c.match)} className="!px-2 !py-0.5">
                        {MATCH_LABELS[c.match]}
                      </Pill>
                      <span className="tnum">
                        {formatDistance(c.distance_m)} away
                      </span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openExisting(c)}
                  >
                    Open existing
                  </Button>
                </li>
              ))}
            </ul>
            {hasExact && (
              <Button
                size="sm"
                variant="danger"
                block
                className="mt-3"
                disabled={submitting}
                onClick={() => {
                  setDupConfirmed(true);
                  void create();
                }}
              >
                Add anyway
              </Button>
            )}
          </Card>
        )}

        <Card className="space-y-4">
          <Input
            label="Shop name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sharma Kirana Store"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Shop type"
              value={profile.shop_type ?? ''}
              onChange={(e) => setP('shop_type', e.target.value)}
              placeholder="Kirana / GT"
            />
            <Select
              label="Class"
              value={outletClass}
              onChange={(e) => setOutletClass(e.target.value)}
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </Select>
          </div>
          <Input
            label="Owner name"
            value={profile.owner_name ?? ''}
            onChange={(e) => setP('owner_name', e.target.value)}
          />
          <Input
            label="Owner phone"
            type="tel"
            inputMode="tel"
            value={profile.owner_phone ?? ''}
            onChange={(e) => setP('owner_phone', e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="GST"
              value={profile.gst ?? ''}
              onChange={(e) => setP('gst', e.target.value)}
            />
            <Input
              label="PAN"
              value={(profile.pan as string) ?? ''}
              onChange={(e) => setP('pan', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Refrigeration"
              value={profile.refrigeration ? 'yes' : 'no'}
              onChange={(e) => setP('refrigeration', e.target.value === 'yes')}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </Select>
            <Input
              label="Shelf space"
              value={profile.shelf_space ?? ''}
              onChange={(e) => setP('shelf_space', e.target.value)}
              placeholder="e.g. 2 shelves"
            />
          </div>
          <Input
            label="Est. monthly volume (₹)"
            type="number"
            inputMode="numeric"
            value={(profile.est_monthly_volume as number) ?? ''}
            onChange={(e) =>
              setP('est_monthly_volume', Number(e.target.value) || undefined)
            }
          />
          <Input
            label="Preferred order day"
            value={profile.preferred_order_day ?? ''}
            onChange={(e) => setP('preferred_order_day', e.target.value)}
            placeholder="e.g. Monday"
          />
          <Textarea
            label="Competitor brands"
            value={profile.competitor_brands ?? ''}
            onChange={(e) => setP('competitor_brands', e.target.value)}
          />

          {/* Configurable custom fields from tenant config */}
          {config.outlet_custom_fields.map((cf) => (
            <CustomField
              key={cf.key}
              field={cf}
              value={profile[cf.key]}
              onChange={(v) => setP(cf.key, v as never)}
            />
          ))}
        </Card>

        <GpsStatus
          reading={gps.reading}
          busy={gps.busy}
          error={gps.error}
          onRead={() => void gps.read()}
          thresholdM={config.gps_accuracy_threshold_m}
        />
        <p className="px-1 text-xs text-ink-faint">
          The GPS reading fixes this outlet's geofence centre. Add it while
          you're standing at the shop — that's your check-in, and you'll go
          straight into the catalog to take the first order.
        </p>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl border-t border-line bg-surface/98 p-3 backdrop-blur pb-safe">
        <Button
          variant="gold"
          size="lg"
          block
          loading={submitting}
          onClick={submit}
        >
          Add outlet &amp; take order
        </Button>
      </div>
    </div>
  );
}

function CustomField({
  field,
  value,
  onChange,
}: {
  field: { key: string; label: string; type: string; required?: boolean; options?: string[] };
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (field.type === 'boolean') {
    return (
      <Select
        label={field.label}
        required={field.required}
        value={value ? 'yes' : 'no'}
        onChange={(e) => onChange(e.target.value === 'yes')}
      >
        <option value="no">No</option>
        <option value="yes">Yes</option>
      </Select>
    );
  }
  if (field.type === 'select') {
    return (
      <Select
        label={field.label}
        required={field.required}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select…</option>
        {field.options?.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
    );
  }
  return (
    <Input
      label={field.label}
      required={field.required}
      type={field.type === 'number' ? 'number' : 'text'}
      value={(value as string) ?? ''}
      onChange={(e) =>
        onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)
      }
    />
  );
}
