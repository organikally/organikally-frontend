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
import { FullScreenLoader, EmptyState, ErrorState } from '@/components/ui/Spinner';
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
  ChevronRightIcon,
} from '@/components/ui/icons';
import { REASON_CODE_LABELS } from '@/types/enums';

export function OutletDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: outlet, isLoading, isError, refetch } = useOutlet(id);
  const { data: visits } = useOutletVisits(id);

  if (isLoading) return <FullScreenLoader label="Loading outlet" />;
  if (isError)
    return (
      <div>
        <TopBar title="Outlet" back />
        <ErrorState
          body="Could not load this outlet."
          onRetry={() => void refetch()}
        />
      </div>
    );
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
              className="btn-outline mt-3 w-full"
            >
              <PhoneIcon className="h-5 w-5" /> Call {p.owner_name || 'owner'}
            </a>
          )}
        </Card>

        {/* Map + navigate */}
        <Card className="!p-0 overflow-hidden">
          <MiniMap outlets={[outlet]} height={160} />
          <div className="flex items-center justify-between p-3">
            <span className="flex items-center gap-1.5 text-sm tnum text-ink-faint">
              <MapPinIcon className="h-4 w-4" />
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </span>
            <a
              href={geoLink(lat, lng, outlet.name)}
              className="inline-flex items-center gap-0.5 text-sm font-semibold text-info"
            >
              Navigate
              <ChevronRightIcon className="h-4 w-4" />
            </a>
          </div>
        </Card>

        {/* Profile */}
        <Card>
          <h2 className="mb-2.5 font-display text-lg text-ink">Profile</h2>
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
            <p className="mt-2 text-sm text-ink-muted">
              <span className="font-semibold text-ink">Competitors: </span>
              {p.competitor_brands}
            </p>
          )}
        </Card>

        {/* Visit history: hairline grouping, no card-in-card (§4) */}
        <section>
          <h2 className="mb-2.5 font-display text-lg text-ink">Visit history</h2>
          {!visits || visits.length === 0 ? (
            <Card>
              <p className="py-4 text-center text-sm text-ink-faint">
                No visits recorded yet.
              </p>
            </Card>
          ) : (
            <Card className="!p-0">
              <ul className="divide-y divide-line">
                {visits.map((v) => (
                  <li key={v.id} className="p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-sm font-semibold tnum text-ink">
                        <ClockIcon className="h-4 w-4 text-ink-faint" />
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
                        <span className="tnum text-ink-faint">
                          {v.duration_min} min
                        </span>
                      )}
                    </div>
                    {v.pitch?.notes && (
                      <p className="mt-1.5 text-sm text-ink-muted">
                        {v.pitch.notes}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
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
    <div className="rounded-chip bg-surface p-2.5">
      <p className="text-xs text-ink-faint">{label}</p>
      <p
        className={
          'font-semibold tnum ' +
          (tone === 'warning' ? 'text-danger' : 'text-ink')
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
      <dt className="text-ink-faint">{label}</dt>
      <dd className="text-right font-medium text-ink">
        {value === undefined || value === null || value === ''
          ? '-'
          : String(value)}
      </dd>
    </>
  );
}
