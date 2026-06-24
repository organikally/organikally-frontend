import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { MiniMap, geoLink } from '@/components/domain/MiniMap';
import { OutletCard } from '@/components/domain/OutletCard';
import { EmptyState, SkeletonList, ErrorState } from '@/components/ui/Spinner';
import { useTodayRoute } from '@/features/route/data';
import { useGpsReader } from '@/components/domain/GpsReader';
import { pointToLatLng } from '@/lib/geo/geo';
import { RouteIcon, ChevronRightIcon } from '@/components/ui/icons';

export function RouteView() {
  const nav = useNavigate();
  const { data, isLoading, isError, refetch } = useTodayRoute();
  const { reading, read } = useGpsReader();
  const outlets = data?.outlets ?? [];
  const me = reading ? { lat: reading.lat, lng: reading.lng } : null;

  useEffect(() => {
    void read();
  }, [read]);

  return (
    <div>
      <TopBar title="Today's route" subtitle={`${outlets.length} stops`} />
      <div className="space-y-4 p-4">
        {isLoading ? (
          <SkeletonList rows={4} />
        ) : isError ? (
          <ErrorState
            body="Could not load today's route."
            onRetry={() => void refetch()}
          />
        ) : outlets.length === 0 ? (
          <EmptyState
            icon={<RouteIcon className="h-10 w-10" />}
            title="No route assigned"
            body="Your ASM hasn't set a route for today. You can still visit any outlet."
          />
        ) : (
          <>
            <MiniMap
              outlets={outlets}
              me={me}
              height={300}
              onSelect={(o) => nav(`/outlets/${o.id}`)}
            />
            <div className="space-y-2.5">
              {outlets.map((o, i) => {
                const { lat, lng } = pointToLatLng(o.location);
                return (
                  <div key={o.id} className="space-y-1.5">
                    <OutletCard
                      outlet={o}
                      index={i}
                      onPress={() => nav(`/outlets/${o.id}`)}
                    />
                    <a
                      href={geoLink(lat, lng, o.name)}
                      className="ml-10 inline-flex items-center gap-0.5 text-sm font-semibold text-info"
                    >
                      Navigate
                      <ChevronRightIcon className="h-4 w-4" />
                    </a>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
