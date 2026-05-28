// Client for the wizard's /api/admin/wizard/stops endpoint. Used by the
// CityStep + MapStep "Regenerate stops" affordance.
//
// Takes the current draft state + a centre lat/lng (from cityCoords or
// the enum-city centre) and returns a fresh stops array. Shape matches
// the kickoff route's patch.stops so the caller can drop them straight
// into draft.stops.

import { CITY_CENTERS, type HuntDraft, type SuggestedStop } from './data';

export interface RegenCentre {
  lat: number;
  lng: number;
  displayName: string;
}

export interface RegenStop {
  name: string;
  type: string;
  blurb: string;
  lat: number;
  lng: number;
}

function centreFor(draft: HuntDraft): RegenCentre {
  if (draft.cityCoords) {
    return {
      lat: draft.cityCoords.lat,
      lng: draft.cityCoords.lng,
      displayName: draft.cityCoords.displayName,
    };
  }
  const c = CITY_CENTERS[draft.city];
  const cityName = {
    cluj: 'Cluj-Napoca, Romania',
    buc: 'București, Romania',
    brasov: 'Brașov, Romania',
    timisoara: 'Timișoara, Romania',
  }[draft.city];
  return { lat: c.lat, lng: c.lng, displayName: cityName };
}

export async function regenerateStops(
  draft: HuntDraft,
  signal?: AbortSignal,
): Promise<SuggestedStop[]> {
  const apiBase =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
  const centre = centreFor(draft);
  const res = await fetch(`${apiBase}/api/admin/wizard/stops`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    signal,
    body: JSON.stringify({
      centre,
      occasion: draft.occasion,
      theme: draft.theme,
      recipient: draft.recipient,
      stopCount: draft.stopCount,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`regenerate failed: ${res.status} ${txt.slice(0, 200)}`);
  }
  const data = (await res.json()) as { stops: RegenStop[] };
  return data.stops.map((s, i) => ({
    id: `regen-${i}-${s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`,
    lat: s.lat,
    lng: s.lng,
    name: s.name,
    type: s.type,
    time: '20m',
    chosen: true,
    order: i + 1,
    blurb: s.blurb,
    tag: 'AI suggested',
  }));
}
