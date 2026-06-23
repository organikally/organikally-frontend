// Geo helpers — client-side preview of the server's check-in geofence math
// (CONTRACT §6). The server is authoritative; this drives UX (showing in/out of
// fence, distance, accuracy + mock warnings, and whether a flag_reason is
// required before the rep can proceed).

import type { GeoPoint } from '@/types/models';
import type { LocationResult } from '@/lib/bridge/types';

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Haversine distance in meters between two [lat,lng] pairs.
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function pointToLatLng(p: GeoPoint): { lat: number; lng: number } {
  return { lat: p.coordinates[1], lng: p.coordinates[0] };
}

export function latLngToPoint(lat: number, lng: number): GeoPoint {
  return { type: 'Point', coordinates: [lng, lat] };
}

export interface GeofenceEval {
  distance_m: number;
  in_fence: boolean;
  accuracy_ok: boolean;
  is_mock: boolean;
  // True when the rep can proceed without a flag.
  clean: boolean;
  // Human reasons the check-in would be flagged (for the UI prompt).
  flags: string[];
}

// Mirror of CONTRACT §6:
// in_fence = distance ≤ (outlet.geofence_radius_m ?? config) AND
//            accuracy ≤ config.gps_accuracy_threshold_m AND is_mock == false
export function evaluateGeofence(
  outletCenter: GeoPoint,
  reading: LocationResult,
  opts: { geofenceRadiusM: number; gpsAccuracyThresholdM: number },
): GeofenceEval {
  const center = pointToLatLng(outletCenter);
  const distance_m = Math.round(
    haversineMeters(center.lat, center.lng, reading.lat, reading.lng),
  );
  const withinRadius = distance_m <= opts.geofenceRadiusM;
  const accuracy_ok = reading.accuracy <= opts.gpsAccuracyThresholdM;
  const is_mock = !!reading.is_mock;

  const flags: string[] = [];
  if (!withinRadius)
    flags.push(
      `Outside geofence (${distance_m} m away, limit ${opts.geofenceRadiusM} m)`,
    );
  if (!accuracy_ok)
    flags.push(
      `Low GPS accuracy (±${Math.round(reading.accuracy)} m, need ≤${opts.gpsAccuracyThresholdM} m)`,
    );
  if (is_mock) flags.push('Mock location detected');

  const in_fence = withinRadius && accuracy_ok && !is_mock;
  return {
    distance_m,
    in_fence,
    accuracy_ok,
    is_mock,
    clean: in_fence,
    flags,
  };
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}
