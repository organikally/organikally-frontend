import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import { OutletCard } from '@/components/domain/OutletCard';
import { MiniMap } from '@/components/domain/MiniMap';
import { EmptyState, Spinner } from '@/components/ui/Spinner';
import { useOutlets } from '@/features/outlet/data';
import { useGpsReader } from '@/components/domain/GpsReader';
import { haversineMeters, pointToLatLng } from '@/lib/geo/geo';
import {
  PlusIcon,
  SearchIcon,
  ListIcon,
  MapPinIcon,
} from '@/components/ui/icons';
import { Pill } from '@/components/ui/Pill';
import type { OutletStatus } from '@/types/enums';

const STATUS_FILTERS: { value: OutletStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending_approval', label: 'Pending' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'dormant', label: 'Dormant' },
];

export function Outlets() {
  const nav = useNavigate();
  const { data, isLoading } = useOutlets();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<OutletStatus | 'all'>('all');
  const [view, setView] = useState<'list' | 'map'>('list');
  const { reading, read } = useGpsReader();

  const me = reading ? { lat: reading.lat, lng: reading.lng } : null;

  const filtered = useMemo(() => {
    let list = data ?? [];
    if (status !== 'all') list = list.filter((o) => o.status === status);
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter(
        (o) =>
          o.name.toLowerCase().includes(t) ||
          o.code?.toLowerCase().includes(t) ||
          o.profile?.owner_name?.toLowerCase().includes(t),
      );
    }
    if (me) {
      list = [...list].sort((a, b) => {
        const da = haversineMeters(
          me.lat,
          me.lng,
          ...latlng(a.location),
        );
        const db = haversineMeters(me.lat, me.lng, ...latlng(b.location));
        return da - db;
      });
    }
    return list;
  }, [data, status, q, me]);

  return (
    <div>
      <TopBar
        title="Outlets"
        subtitle={`${filtered.length} shown`}
        right={
          <button
            onClick={() => setView((v) => (v === 'list' ? 'map' : 'list'))}
            className="tap flex items-center justify-center rounded-pill text-brand active:bg-surface-2"
            aria-label="Toggle map"
          >
            {view === 'list' ? (
              <MapPinIcon className="h-5 w-5" />
            ) : (
              <ListIcon className="h-5 w-5" />
            )}
          </button>
        }
      />

      <div className="space-y-3 p-4">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, code, owner"
            className="field-input pl-10"
          />
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              className={
                'pill tap !px-3 ' +
                (status === f.value
                  ? 'bg-brand text-cream'
                  : 'bg-surface-2 text-muted')
              }
            >
              {f.label}
            </button>
          ))}
          <button
            onClick={() => void read()}
            className="pill tap !px-3 bg-info/12 text-info"
          >
            <MapPinIcon className="h-3.5 w-3.5" /> Near me
          </button>
        </div>

        {view === 'map' && (
          <MiniMap
            outlets={filtered}
            me={me}
            height={260}
            onSelect={(o) => nav(`/outlets/${o.id}`)}
          />
        )}

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<MapPinIcon className="h-10 w-10" />}
            title="No outlets"
            body="Try a different filter or onboard a new outlet."
            action={
              <Button
                leftIcon={<PlusIcon className="h-5 w-5" />}
                onClick={() => nav('/outlets/onboard')}
              >
                Onboard outlet
              </Button>
            }
          />
        ) : (
          <div className="space-y-2.5">
            {filtered.map((o) => (
              <OutletCard
                key={o.id}
                outlet={o}
                distanceM={
                  me ? haversineMeters(me.lat, me.lng, ...latlng(o.location)) : undefined
                }
                onPress={() => nav(`/outlets/${o.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => nav('/outlets/onboard')}
        className="fixed bottom-[calc(var(--nav,64px)+16px+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-pill bg-gold text-charcoal shadow-card-lg active:scale-95"
        aria-label="Onboard outlet"
      >
        <PlusIcon className="h-7 w-7" />
      </button>

      {me && (
        <Pill tone="info" className="fixed left-4 top-16 z-30 shadow-card">
          Sorted by distance
        </Pill>
      )}
    </div>
  );
}

function latlng(loc: { coordinates: [number, number] }): [number, number] {
  const { lat, lng } = pointToLatLng(loc as never);
  return [lat, lng];
}
