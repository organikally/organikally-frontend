import { Card } from '@/components/ui/Card';
import { OutletStatusPill, ClassPill, Pill } from '@/components/ui/Pill';
import { ChevronRightIcon, MapPinIcon, ClockIcon } from '@/components/ui/icons';
import { fmtDate, relativeTime, inrCompact } from '@/lib/format';
import { formatDistance } from '@/lib/geo/geo';
import type { Outlet } from '@/types/models';

export function OutletCard({
  outlet,
  distanceM,
  index,
  onPress,
}: {
  outlet: Outlet;
  distanceM?: number;
  index?: number;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} className="!p-3.5">
      <div className="flex items-start gap-3">
        {typeof index === 'number' && (
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-yellow/20 text-sm font-bold tabular-nums text-gold-ink">
            {index + 1}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-sans font-semibold text-ink">{outlet.name}</h3>
          </div>
          <p className="truncate text-xs text-ink-faint">
            {outlet.code} · {outlet.profile?.owner_name || 'Owner'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <OutletStatusPill status={outlet.status} />
            <ClassPill outletClass={outlet.outlet_class} />
            {typeof distanceM === 'number' && (
              <Pill tone="info">
                <MapPinIcon className="h-3.5 w-3.5" />
                {formatDistance(distanceM)}
              </Pill>
            )}
            {outlet.outstanding > 0 && (
              <Pill tone="warning">Due {inrCompact(outlet.outstanding)}</Pill>
            )}
          </div>
          {(outlet.last_visit_at || outlet.next_visit_date) && (
            <p className="mt-2 flex items-center gap-1 text-xs text-ink-faint">
              <ClockIcon className="h-3.5 w-3.5" />
              {outlet.last_visit_at
                ? `Last visit ${relativeTime(outlet.last_visit_at)}`
                : `Next ${fmtDate(outlet.next_visit_date)}`}
            </p>
          )}
        </div>
        <ChevronRightIcon className="mt-1 h-5 w-5 shrink-0 text-ink-faint/50" />
      </div>
    </Card>
  );
}
