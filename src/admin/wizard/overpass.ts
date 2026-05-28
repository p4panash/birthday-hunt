// Thin client for the OSM Overpass API — fetches named landmarks /
// museums / cafes / historic POIs within a radius of a centre.
//
// Free, no key. Public mirrors do throttle (~10k req/day per IP) but a
// single panel render is one call; the in-memory cache below keeps us
// way under that.
//
// Docs: https://wiki.openstreetmap.org/wiki/Overpass_API/Language_Guide

export interface PoiKind {
  /** Display label for the kind chip ("Museum", "Café", "Landmark"). */
  label: string;
  /** Lucide-style icon name from our admin Icon set. */
  icon: 'map' | 'pin' | 'cake' | 'star' | 'gift' | 'heart';
}

export interface Poi {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: PoiKind;
  /** Source tag for the chip (e.g. "tourism=museum"). */
  rawTag: string;
}

// Categories we ask Overpass for, in priority order.  Each is a (tag,
// value, displayed kind) triple.  We trust Overpass to fan these out.
const CATEGORIES: { tag: string; value?: string; kind: PoiKind }[] = [
  { tag: 'tourism', value: 'museum',      kind: { label: 'Museum',   icon: 'star' } },
  { tag: 'tourism', value: 'viewpoint',   kind: { label: 'Viewpoint',icon: 'pin' } },
  { tag: 'tourism', value: 'attraction',  kind: { label: 'Landmark', icon: 'star' } },
  { tag: 'historic',                       kind: { label: 'Historic', icon: 'star' } },
  { tag: 'leisure', value: 'park',        kind: { label: 'Park',     icon: 'heart' } },
  { tag: 'amenity', value: 'cafe',        kind: { label: 'Café',     icon: 'cake' } },
  { tag: 'amenity', value: 'bar',         kind: { label: 'Bar',      icon: 'gift' } },
];

interface OverpassNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Per-page cache keyed on (lat, lng, radius) rounded to 0.001 degrees.
// Speeds up the common case where the user re-opens Step 02 after picking
// a city.
const cache = new Map<string, Poi[]>();

function key(lat: number, lng: number, radius: number): string {
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return `${round(lat)},${round(lng)},${radius}`;
}

export interface NearbyOptions {
  /** Search radius in metres. Default 1500 (walkable cluster). */
  radius?: number;
  /** Max POIs to return. Default 8. */
  limit?: number;
  signal?: AbortSignal;
}

/**
 * Fetch up to `limit` named POIs within `radius` metres of (lat, lng).
 * Sorted by kind priority then by name.
 */
export async function fetchNearbyPois(
  lat: number,
  lng: number,
  opts: NearbyOptions = {},
): Promise<Poi[]> {
  const radius = opts.radius ?? 1500;
  const limit = opts.limit ?? 8;
  const cacheKey = key(lat, lng, radius);
  const hit = cache.get(cacheKey);
  if (hit) return hit.slice(0, limit);

  // Build the Overpass QL query: union of named nodes for each category
  // in the radius. `[name]` ensures we only get features with a name (no
  // anonymous benches / posts).
  const parts = CATEGORIES.map((c) =>
    c.value
      ? `node["${c.tag}"="${c.value}"][name](around:${radius},${lat},${lng});`
      : `node["${c.tag}"][name](around:${radius},${lat},${lng});`,
  );
  const query = `[out:json][timeout:15];(${parts.join('')});out body 60;`;

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
    signal: opts.signal,
  });
  if (!res.ok) {
    throw new Error(`overpass ${res.status}`);
  }
  const data = (await res.json()) as { elements: OverpassNode[] };

  const seen = new Set<string>();
  const pois: Poi[] = [];
  for (const node of data.elements ?? []) {
    if (node.type !== 'node') continue;
    const tags = node.tags ?? {};
    const name = tags.name;
    if (!name) continue;
    // Dedupe by (name) — Overpass can return the same place twice if it
    // matched two of our queries.
    if (seen.has(name)) continue;
    seen.add(name);

    // Find the first category that matches this node.
    let kind: PoiKind | null = null;
    let rawTag = '';
    for (const c of CATEGORIES) {
      const v = tags[c.tag];
      if (!v) continue;
      if (c.value && v !== c.value) continue;
      kind = c.kind;
      rawTag = `${c.tag}=${v}`;
      break;
    }
    if (!kind) continue;

    pois.push({
      id: 'osm-' + node.id,
      name,
      lat: node.lat,
      lng: node.lon,
      kind,
      rawTag,
    });
  }

  // Stable order: category priority (CATEGORIES order) → alpha by name.
  const order = new Map(CATEGORIES.map((c, i) => [c.kind.label, i]));
  pois.sort((a, b) => {
    const ai = order.get(a.kind.label) ?? 99;
    const bi = order.get(b.kind.label) ?? 99;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });

  cache.set(cacheKey, pois);
  return pois.slice(0, limit);
}
