// Dependency-free mini-map. Renders outlet pins positioned by normalized
// lat/lng inside a styled "tile" surface — no network tiles (works offline),
// no heavy mapping library (keeps the bundle lean for cheap phones). Each pin
// deep-links to the device maps app for real navigation.

import { useMemo } from 'react';
import type { Outlet } from '@/types/models';
import { pointToLatLng } from '@/lib/geo/geo';
import { MapPinIcon } from '@/components/ui/icons';

interface Props {
  outlets: Outlet[];
  me?: { lat: number; lng: number } | null;
  height?: number;
  onSelect?: (o: Outlet) => void;
  selectedId?: string;
}

export function geoLink(lat: number, lng: number, label?: string): string {
  const q = label ? encodeURIComponent(label) : `${lat},${lng}`;
  return `geo:${lat},${lng}?q=${lat},${lng}(${q})`;
}

export function MiniMap({
  outlets,
  me,
  height = 220,
  onSelect,
  selectedId,
}: Props) {
  const points = useMemo(
    () =>
      outlets
        .filter((o) => o.location?.coordinates)
        .map((o) => ({ o, ...pointToLatLng(o.location) })),
    [outlets],
  );

  const bounds = useMemo(() => {
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    if (me) {
      lats.push(me.lat);
      lngs.push(me.lng);
    }
    if (!lats.length) return null;
    let minLat = Math.min(...lats);
    let maxLat = Math.max(...lats);
    let minLng = Math.min(...lngs);
    let maxLng = Math.max(...lngs);
    // pad
    const padLat = (maxLat - minLat || 0.01) * 0.2 + 0.002;
    const padLng = (maxLng - minLng || 0.01) * 0.2 + 0.002;
    minLat -= padLat;
    maxLat += padLat;
    minLng -= padLng;
    maxLng += padLng;
    return { minLat, maxLat, minLng, maxLng };
  }, [points, me]);

  function project(lat: number, lng: number) {
    if (!bounds) return { x: 50, y: 50 };
    const x =
      ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng || 1)) * 100;
    const y =
      (1 - (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat || 1)) * 100;
    return { x, y };
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-card border border-line"
      style={{
        height,
        backgroundColor: '#EEF1E8',
        backgroundImage:
          'linear-gradient(#E0E4D6 1px, transparent 1px), linear-gradient(90deg, #E0E4D6 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
      role="img"
      aria-label="Outlet locations map"
    >
      {/* subtle "roads" */}
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div className="absolute left-0 right-0 top-1/3 h-[3px] bg-[#D6DBC8]" />
        <div className="absolute bottom-1/4 left-0 right-0 h-[3px] bg-[#D6DBC8]" />
        <div className="absolute bottom-0 left-2/3 top-0 w-[3px] bg-[#D6DBC8]" />
      </div>

      {me && bounds && <Marker {...project(me.lat, me.lng)} label="You" />}

      {points.map(({ o, lat, lng }) => {
        const pos = project(lat, lng);
        return (
          <button
            key={o.id}
            onClick={() => onSelect?.(o)}
            className="absolute -translate-x-1/2 -translate-y-full"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            aria-label={o.name}
          >
            <span
              className={
                'flex h-7 w-7 items-center justify-center rounded-pill border-2 border-white shadow-card ' +
                (o.id === selectedId ? 'bg-gold' : 'bg-brand')
              }
            >
              <MapPinIcon className="h-4 w-4 text-cream" />
            </span>
          </button>
        );
      })}

      {!points.length && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
          No located outlets
        </div>
      )}
    </div>
  );
}

function Marker({
  x,
  y,
  label,
}: {
  x: number;
  y: number;
  label: string;
}) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${x}%`, top: `${y}%` }}
      aria-label={label}
    >
      <span className="relative flex h-4 w-4">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-pill bg-info/50" />
        <span className="relative inline-flex h-4 w-4 rounded-pill border-2 border-white bg-info" />
      </span>
    </div>
  );
}
