// Thin client for OpenStreetMap's Nominatim geocoding API. Used by the
// wizard's City & area step to do real-time search-as-you-type.
//
// Free service, no API key, but rate-limited to ~1 req/sec per IP and
// strict on the ToS. We debounce on the React side, cache identical
// queries in-memory for the session, and bias toward Romania by default.
//
// Docs: https://nominatim.org/release-docs/develop/api/Search/

export interface GeocodeResult {
  /** Stable string id from Nominatim (place_id). */
  id: string;
  /** Full "Centru istoric, Cluj-Napoca, Cluj, Romania" string. */
  displayName: string;
  /** Compact label suitable for chips / pills (city or neighbourhood). */
  shortLabel: string;
  /** Secondary label below the primary (admin area + country). */
  context: string;
  lat: number;
  lng: number;
  /** "city" | "town" | "village" | "suburb" | "neighbourhood" | ... */
  kind: string;
  /** Suggested map zoom for centring the result. */
  zoom: number;
}

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

// Per-page cache. Speeds up backspace + retype, keeps us under the rate
// limit for repeated probes.
const cache = new Map<string, GeocodeResult[]>();

interface RawHit {
  place_id: number | string;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  addresstype?: string;
  class?: string;
  name?: string;
  address?: Record<string, string>;
}

// Map Nominatim's `addresstype` to a sensible zoom level.
function zoomFor(kind: string): number {
  switch (kind) {
    case 'country': return 6;
    case 'state':
    case 'region': return 8;
    case 'county': return 10;
    case 'city':
    case 'town': return 13;
    case 'village': return 14;
    case 'suburb':
    case 'neighbourhood':
    case 'quarter': return 15;
    case 'road':
    case 'street': return 16;
    case 'house':
    case 'amenity':
    case 'shop': return 17;
    default: return 14;
  }
}

function shortLabelOf(hit: RawHit): string {
  // Prefer the most-specific name field, fall back to first segment of
  // the display_name (which is comma-separated).
  if (hit.name) return hit.name;
  const a = hit.address ?? {};
  return (
    a.neighbourhood ||
    a.suburb ||
    a.quarter ||
    a.city_district ||
    a.city ||
    a.town ||
    a.village ||
    a.county ||
    hit.display_name.split(',')[0]?.trim() ||
    hit.display_name
  );
}

function contextOf(hit: RawHit): string {
  // Drop the most-specific segment (it's already the shortLabel) and the
  // postcode if present, join the rest with a thin separator.
  const parts = hit.display_name.split(',').map((s) => s.trim()).slice(1);
  return parts.filter((p) => !/^\d{4,}$/.test(p)).join(' · ');
}

export interface GeocodeOptions {
  /** ISO-3166 country codes (lowercase). Default: 'ro'. */
  countrycodes?: string;
  signal?: AbortSignal;
  limit?: number;
}

export async function geocode(
  query: string,
  opts: GeocodeOptions = {},
): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const cacheKey = `${trimmed}::${opts.countrycodes ?? 'ro'}::${opts.limit ?? 8}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const params = new URLSearchParams({
    q: trimmed,
    format: 'json',
    addressdetails: '1',
    limit: String(opts.limit ?? 8),
    countrycodes: opts.countrycodes ?? 'ro',
    'accept-language': 'ro,en',
  });
  const res = await fetch(`${NOMINATIM}?${params.toString()}`, {
    signal: opts.signal,
    headers: {
      // Nominatim ToS asks for a descriptive user agent. Browsers ignore
      // attempts to set the actual User-Agent header on fetch, but a
      // Referer (set automatically by the browser to our origin) plus the
      // X-Goodloot-* header below gives operators a fingerprint to
      // identify us if our traffic ever shows up in their logs.
      'X-Goodloot-App': 'wizard-search/1',
    },
  });
  if (!res.ok) {
    throw new Error(`nominatim ${res.status}`);
  }
  const data = (await res.json()) as RawHit[];
  const results: GeocodeResult[] = data.map((raw) => {
    const kind = raw.addresstype ?? raw.type ?? raw.class ?? 'unknown';
    return {
      id: String(raw.place_id),
      displayName: raw.display_name,
      shortLabel: shortLabelOf(raw),
      context: contextOf(raw),
      lat: Number(raw.lat),
      lng: Number(raw.lon),
      kind,
      zoom: zoomFor(kind),
    };
  });
  cache.set(cacheKey, results);
  return results;
}
