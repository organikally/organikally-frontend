import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { OutletCard } from '@/components/domain/OutletCard';
import { EmptyState, SkeletonList, ErrorState } from '@/components/ui/Spinner';
import { useTodayRoute } from '@/features/route/data';
import { useOutletVisitsToday } from '@/features/visit/data';
import { useSession } from '@/stores/session';
import { PlusIcon, RouteIcon, MapPinIcon } from '@/components/ui/icons';
import { fmtDate } from '@/lib/format';

export function Today() {
  const nav = useNavigate();
  const user = useSession((s) => s.user);
  const { data, isLoading, isError, refetch } = useTodayRoute();
  const { data: todayVisits } = useOutletVisitsToday();

  const outlets = data?.outlets ?? [];
  const visitedIds = useMemo(
    () => new Set((todayVisits ?? []).map((v) => v.outlet_id)),
    [todayVisits],
  );
  const planned = outlets.length;
  const done = outlets.filter((o) => visitedIds.has(o.id)).length;
  const progress = planned ? Math.round((done / planned) * 100) : 0;

  return (
    <div>
      <TopBar
        title={
          <span>
            Hi, {user?.name?.split(' ')[0] || 'Rep'}
          </span>
        }
        subtitle={fmtDate(new Date().toISOString())}
      />

      <div className="space-y-4 p-4">
        {/* Header: route progress when a route exists, else area framing —
            reps discover and onboard shops themselves, routes aren't required. */}
        {planned > 0 ? (
          <Card className="border-ink bg-ink text-paper">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow text-yellow before:bg-yellow/60">
                  Today's route
                </p>
                <p className="mt-1.5 text-2xl font-semibold tabular-nums">
                  {done}/{planned}
                  <span className="ml-1 text-sm font-normal text-paper/70">
                    visited
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-4xl tabular-nums text-yellow">
                  {progress}%
                </p>
                <p className="text-xs text-paper/70">complete</p>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-pill bg-paper/20">
              <div
                className="h-full rounded-pill bg-yellow transition-all duration-300 ease-brand"
                style={{ width: `${progress}%` }}
              />
            </div>
          </Card>
        ) : (
          <Card className="border-ink bg-ink text-paper">
            <p className="eyebrow text-yellow before:bg-yellow/60">Your area</p>
            <p className="mt-1.5 font-display text-xl">Work your area</p>
            <p className="mt-1 text-sm text-paper/70">
              Find shops nearby, add them on the spot, and take the first order.
            </p>
          </Card>
        )}

        {/* Quick actions — compact tiles, never wrap on narrow screens */}
        <div className="grid grid-cols-2 gap-2.5">
          <Button
            variant="gold"
            size="sm"
            block
            leftIcon={<PlusIcon className="h-4 w-4 shrink-0" />}
            onClick={() => nav('/outlets/onboard')}
            className="min-h-12"
          >
            <span className="truncate">Onboard outlet</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            block
            leftIcon={<RouteIcon className="h-4 w-4 shrink-0" />}
            onClick={() => nav('/route')}
            className="min-h-12"
          >
            <span className="truncate">Route map</span>
          </Button>
        </div>

        {/* Route outlets (when a route exists) / area prompt otherwise */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">
              {planned > 0 ? 'Route outlets' : 'Your area'}
            </h2>
            {planned > 0 && (
              <button
                onClick={() => nav('/route')}
                className="text-sm font-semibold text-gold-ink"
              >
                Map view
              </button>
            )}
          </div>

          {isLoading ? (
            <SkeletonList rows={4} />
          ) : isError ? (
            <ErrorState
              body="Could not load today's route."
              onRetry={() => void refetch()}
            />
          ) : outlets.length === 0 ? (
            <EmptyState
              icon={<MapPinIcon className="h-10 w-10" />}
              title="No route assigned"
              body="Start by finding and onboarding shops in your area — add them on the spot and take the first order."
              action={
                <div className="flex flex-col items-stretch gap-2">
                  <Button
                    variant="gold"
                    leftIcon={<PlusIcon className="h-4 w-4 shrink-0" />}
                    onClick={() => nav('/outlets/onboard')}
                  >
                    Onboard outlet
                  </Button>
                  <Button variant="ghost" onClick={() => nav('/outlets')}>
                    Browse outlets
                  </Button>
                </div>
              }
            />
          ) : (
            <div className="space-y-2.5">
              {outlets.map((o, i) => (
                <OutletCard
                  key={o.id}
                  outlet={o}
                  index={i}
                  onPress={() => nav(`/outlets/${o.id}`)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
