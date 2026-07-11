import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { CameraCapture } from '@/components/domain/CameraCapture';
import { GpsStatus, useGpsReader } from '@/components/domain/GpsReader';
import { toast } from '@/components/ui/Toast';
import { useConfig } from '@/hooks/useConfig';
import { useSession } from '@/stores/session';
import { latLngToPoint } from '@/lib/geo/geo';
import {
  dataUrlToBlob,
  enqueueOutletCreate,
  newClientUuid,
  queuePhoto,
} from '@/lib/offline/mutations';
import type { OutletCreateRequest } from '@/types/api';
import type { OutletProfile } from '@/types/models';

// First-visit onboarding: live shop photo + name + GPS (fixes geofence) +
// profile fields → submitted as pending_approval (CONTRACT §4 outlets POST).
export function OnboardOutlet() {
  const nav = useNavigate();
  const config = useConfig();
  const user = useSession((s) => s.user);
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

  function setP<K extends keyof OutletProfile>(k: K, v: OutletProfile[K]) {
    setProfile((prev) => ({ ...prev, [k]: v }));
  }

  async function submit() {
    if (!name.trim()) return toast.error('Shop name is required');
    if (!photo) return toast.error('Live shop photo is required');
    if (!gps.reading)
      return toast.error('Read GPS to fix the outlet location');

    setSubmitting(true);
    try {
      const client_uuid = newClientUuid();
      // Queue the live photo blob; embed a token resolved on upload.
      const blob = await dataUrlToBlob(photo);
      const photoToken = await queuePhoto(blob, 'outlet');

      // Apply custom fields from config into profile (already in `profile`).
      const body: OutletCreateRequest = {
        name: name.trim(),
        location: latLngToPoint(gps.reading.lat, gps.reading.lng),
        photos: [photoToken],
        profile,
        outlet_class: outletClass,
        territory_id: user?.territory_ids?.[0] ?? null,
        client_uuid,
      };

      await enqueueOutletCreate(body, {
        name: name.trim(),
        outlet_class: outletClass as never,
        assigned_rep_id: user?.id ?? null,
        created_by: user?.id ?? null,
      });

      toast.success('Outlet queued, pending approval');
      nav(`/outlets/local:${client_uuid}`, { replace: true });
    } catch (e) {
      toast.error((e as Error).message || 'Failed to queue outlet');
    } finally {
      setSubmitting(false);
    }
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
          The GPS reading fixes this outlet's geofence centre. Submit when
          you're standing at the shop.
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
          Submit for approval
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
