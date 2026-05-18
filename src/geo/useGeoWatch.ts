import { useEffect, useState } from 'react';
import { haversineMeters } from './haversine';
import { useTestOverrides } from '../lib/testOverrides';

export type GeoStatus =
  | 'idle'
  | 'watching'
  | 'denied'
  | 'unavailable'
  | 'error';

export type GeoReading = {
  status: GeoStatus;
  distanceMeters: number | null;
  accuracyMeters: number | null;
  error: string | null;
};

const IDLE_READING: GeoReading = {
  status: 'idle',
  distanceMeters: null,
  accuracyMeters: null,
  error: null,
};

/**
 * Watches the device position and returns the distance to `target` in meters.
 * Pass `null` to pause watching.
 *
 * When `testOverrides.mockGeo` is set (test mode), real GPS is bypassed and
 * the mock is used instead — distance is computed against the mock coords.
 */
export function useGeoWatch(
  target: { lat: number; lng: number } | null,
): GeoReading {
  const [reading, setReading] = useState<GeoReading>(IDLE_READING);
  const { mockGeo } = useTestOverrides();

  // Mocked path — pure compute, no real watcher.
  useEffect(() => {
    if (!target || !mockGeo) return;
    const d = haversineMeters(mockGeo.lat, mockGeo.lng, target.lat, target.lng);
    setReading({
      status: 'watching',
      distanceMeters: d,
      accuracyMeters: mockGeo.accuracy,
      error: null,
    });
  }, [target?.lat, target?.lng, mockGeo]);

  // Real GPS path — only runs when mock is OFF.
  useEffect(() => {
    if (!target) {
      setReading(IDLE_READING);
      return;
    }
    if (mockGeo) return; // mock takes over above
    if (!('geolocation' in navigator)) {
      setReading({ ...IDLE_READING, status: 'unavailable', error: 'no geolocation api' });
      return;
    }

    setReading((prev) => ({ ...prev, status: 'watching' }));

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const d = haversineMeters(
          pos.coords.latitude,
          pos.coords.longitude,
          target.lat,
          target.lng,
        );
        setReading({
          status: 'watching',
          distanceMeters: d,
          accuracyMeters: pos.coords.accuracy,
          error: null,
        });
      },
      (err) => {
        const status: GeoStatus = err.code === err.PERMISSION_DENIED ? 'denied' : 'error';
        setReading((prev) => ({
          ...prev,
          status,
          error: err.message || err.code.toString(),
        }));
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [target?.lat, target?.lng, mockGeo]);

  return reading;
}

/** Map a distance in meters to one of four warmth tiers used by config copy. */
export type WarmthTier = 'veryFar' | 'far' | 'close' | 'onTop' | 'unknown';

export function tierFromDistance(distanceMeters: number | null): WarmthTier {
  if (distanceMeters == null) return 'unknown';
  if (distanceMeters > 500) return 'veryFar';
  if (distanceMeters > 200) return 'far';
  if (distanceMeters > 50) return 'close';
  return 'onTop';
}
