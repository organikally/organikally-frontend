import { useParams, useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  OutletStatusPill,
  ClassPill,
  Pill,
  FencePill,
} from '@/components/ui/Pill';
import { FullScreenLoader, EmptyState } from '@/components/ui/Spinner';
import { MiniMap, geoLink } from '@/components/domain/MiniMap';
import { useOutlet, useOutletVisits } from '@/features/outlet/data';
import { pointToLatLng } from '@/lib/geo/geo';
import { inr, fmtDate, fmtDateTime, relativeTime } from '@/lib/format';
import {
  PhoneIcon,
  MapPinIcon,
  CheckIcon,
  ClockIcon,
  PackageIcon,
} from '@/components/ui/icons';
import { REASON_CODE_LABELS } from '@/types/enums';

export function OutletDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: outlet, isLoading } = useOutlet(id);
  const { data: visits } = useOutletVisits(id);

  if (isLoading) return <FullScreenLoader label="Loading outlet" />;
  if (!outlet)
    return (
      <div>
        <TopBar title="Outlet" back />
        <EmptyState title="Outlet not found" />
      </div>
    );

  const { lat, lng } = pointToLatLng(outlet.location);
  const isLocal = outlet.id.startsWith('local:');
  const p = outlet.profile ?? {};

  return (
    <div className="pb-24">
      <TopBar title={outlet.name} subtitle={outlet.code} back />

      <div className="space-y-4 p-4">
        <Card>
          <div className="flex flex-wrap items-center gap-1.5">
            <OutletStatusPill status={outlet.status} />
            <ClassPill outletClass={outlet.outlet_class} />
            {isLocal && <Pill tone="warning">Not yet synced</Pill>}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Stat label="Credit limit" value={inr(outlet.credit_limit)} />
            <Stat
              label="Outstanding"
              value={inr(outlet.outstanding)}
              tone={outlet.outstanding > 0 ? 'warning' : undefined}
            />
            <Stat label="Last order" value={fmtDate(outlet.last_order_at)} />
            <Stat label="Last visit" value={relativeTime(outlet.last_visit_at)} />
          </div>

          {p.owner_phone && (
            <a
              href={`tel:${p.owner_phone}`}
              className="btn-outline mt-3 w-full !border-brand"
            >
              <PhoneIcon className="h-5 w-5" /> Call {p.owner_name || 'owner'}
            </a>
          )}
        </Card>

        {/* Map + navigate */}
        <Card className="!p-0 overflow-hidden">
          <MiniMap outlets={[outlet]} height={160} />
          <div className="flex items-center justify-between p-3">
            <span className="flex items-center gap-1.5 text-sm text-muted">
              <MapPinIcon className="h-4 w-4" />
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </span>
            <a
              href={geoLink(lat, lng, outlet.name)}
              className="text-sm font-semibold text-info"
            >
              Navigate →
            </a>
          </div>
        </Card>

        {/* Profile */}
        <Card>
          <h3 className="mb-2 font-semibold text-ink">Profile</h3>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <Field label="Shop type" value={p.shop_type} />
            <Field label="Owner" value={p.owner_name} />
            <Field label="GST" value={p.gst} />
            <Field label="PAN" value={p.pan} />
            <Field
              label="Refrigeration"
              value={p.refrigeration ? 'Yes' : 'No'}
            />
            <Field label="Shelf space" value={p.shelf_space} />
            <Field
              label="Est. volume"
              value={p.est_monthly_volume ? `${p.est_monthly_volume}/mo` : undefined}
            />
            <Field label="Order day" value={p.preferred_order_day} />
          </dl>
          {p.competitor_brands && (
            <p className="mt-2 text-sm text-muted">
              <span className="font-semibold text-ink">Competitors: </span>
              {p.competitor_brands}
            </p>
          )}
        </Card>

        {/* Visit history */}
        <section>
          <h3 className="mb-2 font-semibold text-ink">Visit history</h3>
          {!visits || visits.length === 0 ? (
            <Card>
              <p className="py-4 text-center text-sm text-muted">
                No visits recorded yet.
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {visits.map((v) => (
                <Card key={v.id} className="!p-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                      <ClockIcon className="h-4 w-4 text-muted" />
                      {fmtDateTime(v.check_in?.timestamp ?? v.created_at)}
                    </span>
                    {v.check_in && (
                      <FencePill inFence={v.check_in.in_fence} />
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                    {v.outcome && (
                      <Pill
                        tone={v.outcome === 'order_placed' ? 'success' : 'neutral'}
                      >
                        {v.outcome === 'order_placed' ? (
                          <>
                            <PackageIcon className="h-3.5 w-3.5" /> Order placed
                          </>
                        ) : (
                          'No order'
                        )}
                      </Pill>
                    )}
                    {v.reason_code && (
                      <Pill tone="warning">
                        {REASON_CODE_LABELS[v.reason_code]}
                      </Pill>
                    )}
                    {typeof v.duration_min === 'number' && (
                      <span className="text-muted">{v.duration_min} min</span>
                    )}
                  </div>
                  {v.pitch?.notes && (
                    <p className="mt-1.5 text-sm text-muted">{v.pitch.notes}</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Sticky check-in */}
      <div className="fixed inset-x-0 bottom-[calc(var(--nav,64px)+env(safe-area-inset-bottom))] z-30 mx-auto max-w-xl border-t border-line bg-surface/98 p-3 backdrop-blur pb-3">
        <Button
          variant="primary"
          size="lg"
          block
          leftIcon={<CheckIcon className="h-5 w-5" />}
          onClick={() => nav(`/outlets/${outlet.id}/check-in`)}
        >
          Check in
        </Button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'warning';
}) {
  return (
    <div className="rounded-card bg-surface-2 p-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={
          'font-semibold ' + (tone === 'warning' ? 'text-danger' : 'text-ink')
        }
      >
        {value}
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: unknown }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">
        {value === undefined || value === null || value === ''
          ? '—'
          : String(value)}
      </dd>
    </>
  );
}
