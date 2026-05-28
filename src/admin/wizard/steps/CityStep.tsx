import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../Icon';
import {
  CITIES,
  STEPS,
  type CityId,
  type CityCoords,
  type HuntDraft,
  type SuggestedStop,
} from '../data';
import { MapCanvas } from '../MapCanvas';
import { AiNudge, Field, StepPage } from '../primitives';
import { geocode, type GeocodeResult } from '../geocode';
import { fetchNearbyPois, type Poi } from '../overpass';
import { regenerateStops } from '../regenerateStops';

interface Props {
  draft: HuntDraft;
  set: <K extends keyof HuntDraft>(k: K, v: HuntDraft[K]) => void;
  /** Called when AI returns fresh stops — replaces draft.stops + clears suggestions. */
  onRegenStops?: (stops: HuntDraft['stops']) => void;
  /** Click-to-add from the city-aware Popular grid. */
  addStop?: (s: SuggestedStop) => void;
}

// Match the picked city (or geocoded result) to one of our 4 supported
// enum cities. If none of them fit, we keep `draft.city` at its previous
// value and rely on `draft.cityCoords` for the map.
function inferCityId(displayName: string, lat: number, lng: number): CityId | null {
  const lower = displayName.toLowerCase();
  if (lower.includes('cluj-napoca') || lower.includes('cluj napoca') || lower.includes(' cluj,')) return 'cluj';
  if (lower.includes('bucurești') || lower.includes('bucuresti') || lower.includes('bucharest')) return 'buc';
  if (lower.includes('brașov') || lower.includes('brasov')) return 'brasov';
  if (lower.includes('timișoara') || lower.includes('timisoara')) return 'timisoara';
  // Coarse rectangular bounds for each city as a fallback if the display
  // string doesn't name the city explicitly (e.g. a neighbourhood-only hit).
  if (lat > 46.7 && lat < 46.85 && lng > 23.5 && lng < 23.7) return 'cluj';
  if (lat > 44.35 && lat < 44.55 && lng > 25.95 && lng < 26.25) return 'buc';
  if (lat > 45.6 && lat < 45.7 && lng > 25.55 && lng < 25.65) return 'brasov';
  if (lat > 45.7 && lat < 45.8 && lng > 21.15 && lng < 21.3) return 'timisoara';
  return null;
}

export default function CityStep({ draft, set, onRegenStops, addStop }: Props) {
  const areas = ['Centru istoric', 'Piața Unirii', 'Mănăștur', 'Gheorgheni', 'Mărăști', 'Iris'];
  const [regenBusy, setRegenBusy] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const canRegen = Boolean(draft.cityCoords) || Boolean(draft.city);

  async function doRegenerate() {
    if (!onRegenStops || !canRegen) return;
    setRegenBusy(true);
    setRegenError(null);
    try {
      const stops = await regenerateStops(draft);
      onRegenStops(stops);
    } catch (e) {
      setRegenError((e as Error).message);
    } finally {
      setRegenBusy(false);
    }
  }

  return (
    <StepPage
      step={STEPS[1]}
      intro="Pick a city — or search a neighbourhood, address, or landmark. We'll narrow stop suggestions to walking distance from your choice."
    >
      <PlaceSearch draft={draft} set={set} />

      {draft.cityCoords ? (
        <PopularNearby
          centre={draft.cityCoords}
          stopIds={draft.stops.map((s) => s.id)}
          onAdd={addStop}
        />
      ) : (
        <>
          <div className="label" style={{ marginBottom: 10, marginTop: 22 }}>
            Popular
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}
          >
            {CITIES.map((c) => {
              const on = draft.city === c.id;
              return (
                <div
                  key={c.id}
                  className="card"
                  style={{
                    padding: 16,
                    cursor: 'pointer',
                    borderColor: on ? 'var(--terra)' : 'var(--line)',
                    background: on ? 'var(--terra-soft)' : 'var(--paper)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }}
                  onClick={() => {
                    set('city', c.id as CityId);
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 8,
                      background: 'var(--bg-2)',
                      border: '1px solid var(--line)',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <MapCanvas tone="light" showLabels={false} density={0.3} />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name="pin" size={18} color="var(--terra)" />
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="serif" style={{ fontSize: 22, lineHeight: 1 }}>
                      {c.name}
                    </div>
                    <div
                      style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}
                    >
                      {c.meta}
                    </div>
                  </div>
                  <span className="chip chip-mono">{c.tag}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div style={{ marginTop: 28 }}>
        <Field label="Area within the city" hint="Quick chips for common districts — or search above for anywhere.">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {areas.map((a) => {
              const on = draft.area === a;
              return (
                <button
                  key={a}
                  className="chip"
                  onClick={() => set('area', a)}
                  style={{
                    cursor: 'pointer',
                    background: on ? 'var(--ink)' : 'var(--paper)',
                    color: on ? 'var(--bg)' : 'var(--ink)',
                    borderColor: on ? 'var(--ink)' : 'var(--line)',
                    padding: '7px 12px',
                    fontSize: 12.5,
                  }}
                >
                  {a}
                  {on ? ' ✓' : ''}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      {onRegenStops && (
        <div
          style={{
            marginTop: 24,
            padding: '14px 16px',
            border: '1px dashed var(--line-2)',
            borderRadius: 'var(--r-md)',
            background: 'var(--bg-2)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="mono"
              style={{
                fontSize: 10.5,
                letterSpacing: '0.12em',
                color: 'var(--muted)',
                textTransform: 'uppercase',
              }}
            >
              Changed your mind?
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: 'var(--ink-2)',
                marginTop: 4,
                fontFamily: 'var(--serif)',
                fontStyle: 'italic',
              }}
            >
              Regenerate stops around{' '}
              <span style={{ fontStyle: 'normal', color: 'var(--ink)' }}>
                {draft.cityCoords?.shortLabel ??
                  CITIES.find((c) => c.id === draft.city)?.name ??
                  '—'}
              </span>
              {regenError && (
                <span
                  className="mono"
                  style={{
                    color: 'var(--terra)',
                    marginLeft: 8,
                    fontStyle: 'normal',
                  }}
                >
                  · {regenError}
                </span>
              )}
            </div>
          </div>
          <button
            className="btn btn-ghost"
            disabled={regenBusy || !canRegen}
            onClick={doRegenerate}
            style={{ fontSize: 12, padding: '8px 14px', whiteSpace: 'nowrap' }}
          >
            {regenBusy ? (
              'Regenerating…'
            ) : (
              <>
                <Icon name="spark" size={13} /> Regenerate stops
              </>
            )}
          </button>
        </div>
      )}

      <AiNudge>
        Bounded radius 800m. 4–6 stops fit a tight walkable loop without burning out the
        hunters.
      </AiNudge>
    </StepPage>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Place search — debounced Nominatim autocomplete
// ─────────────────────────────────────────────────────────────────────

interface PlaceSearchProps {
  draft: HuntDraft;
  set: <K extends keyof HuntDraft>(k: K, v: HuntDraft[K]) => void;
}

function PlaceSearch({ draft, set }: PlaceSearchProps) {
  const [query, setQuery] = useState(draft.cityCoords?.shortLabel ?? '');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [status, setStatus] = useState<'idle' | 'searching' | 'error' | 'no-results'>('idle');
  const [focused, setFocused] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Debounce queries to ~250ms. Also abort any in-flight request when
  // the query changes, so we don't apply stale results.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setStatus('idle');
      return;
    }
    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      setStatus('searching');
      try {
        const hits = await geocode(query, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setResults(hits);
        setStatus(hits.length === 0 ? 'no-results' : 'idle');
        setHighlightIdx(0);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setStatus('error');
        setResults([]);
      }
    }, 250);
    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [query]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

  function pick(r: GeocodeResult) {
    const cityId = inferCityId(r.displayName, r.lat, r.lng);
    if (cityId) {
      set('city', cityId);
    }
    set('cityCoords', {
      lat: r.lat,
      lng: r.lng,
      zoom: r.zoom,
      displayName: r.displayName,
      shortLabel: r.shortLabel,
    });
    // For neighbourhood-class hits, also seed the area field so the chip
    // below the city cards reflects the choice.
    if (
      r.kind === 'suburb' ||
      r.kind === 'neighbourhood' ||
      r.kind === 'quarter' ||
      r.kind === 'city_district'
    ) {
      set('area', r.shortLabel);
    }
    setQuery(r.shortLabel);
    setFocused(false);
    inputRef.current?.blur();
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!focused || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = results[highlightIdx];
      if (r) pick(r);
    } else if (e.key === 'Escape') {
      setFocused(false);
    }
  }

  const showDropdown =
    focused &&
    (results.length > 0 || status === 'searching' || status === 'no-results' || status === 'error');

  const cleared = useMemo(
    () => draft.cityCoords && draft.cityCoords.shortLabel !== query,
    [draft.cityCoords, query],
  );

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Icon
          name="search"
          size={16}
          color="var(--muted)"
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        />
        <input
          ref={inputRef}
          className="input"
          placeholder="Search a city, neighbourhood, landmark, or address"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={onKey}
          style={{ paddingLeft: 38, paddingRight: query ? 84 : 14, fontSize: 14 }}
          aria-autocomplete="list"
          aria-expanded={showDropdown}
        />
        {status === 'searching' && (
          <span
            className="mono"
            style={{
              position: 'absolute',
              right: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 10,
              color: 'var(--muted)',
              letterSpacing: '0.08em',
            }}
          >
            searching…
          </span>
        )}
        {query && status !== 'searching' && (
          <button
            onClick={() => {
              setQuery('');
              set('cityCoords', undefined as unknown as CityCoords);
              inputRef.current?.focus();
            }}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              borderRadius: 4,
            }}
            aria-label="clear search"
          >
            <Icon name="x" size={14} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--paper)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow-2)',
            zIndex: 10,
            maxHeight: 320,
            overflowY: 'auto',
          }}
        >
          {status === 'searching' && results.length === 0 && (
            <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--muted)' }}>
              searching Romania…
            </div>
          )}
          {status === 'no-results' && (
            <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--muted)' }}>
              No matches in Romania. Try a different spelling, or pick from the popular cities below.
            </div>
          )}
          {status === 'error' && (
            <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--terra)' }}>
              Couldn't reach the geocoder. Try again in a moment.
            </div>
          )}
          {results.map((r, i) => {
            const active = i === highlightIdx;
            return (
              <button
                key={r.id}
                role="option"
                aria-selected={active}
                onMouseEnter={() => setHighlightIdx(i)}
                onClick={() => pick(r)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: active ? 'var(--bg-2)' : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--line-2)',
                  padding: '10px 14px',
                  cursor: 'pointer',
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  alignItems: 'center',
                  gap: 12,
                  fontFamily: 'var(--sans)',
                }}
              >
                <Icon
                  name={iconForKind(r.kind)}
                  size={14}
                  color={active ? 'var(--terra)' : 'var(--muted)'}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      color: 'var(--ink)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r.shortLabel}
                  </div>
                  {r.context && (
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--muted)',
                        marginTop: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.context}
                    </div>
                  )}
                </div>
                <span
                  className="chip chip-mono"
                  style={{ fontSize: 9, padding: '2px 7px', background: 'var(--bg-2)' }}
                >
                  {r.kind}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Picked place chip — surfaces below the input once a result has
          been chosen, so the user sees what's currently set without
          reopening the dropdown. */}
      {draft.cityCoords && !focused && !cleared && (
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            background: 'var(--terra-soft)',
            border: '1px solid oklch(0.85 0.06 45)',
            borderRadius: 'var(--r-md)',
            fontSize: 12,
            color: 'var(--ink-2)',
          }}
        >
          <Icon name="pin" size={13} color="var(--terra)" />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 500, color: 'var(--ink)' }}>
              {draft.cityCoords.shortLabel}
            </span>
            <span className="mono" style={{ marginLeft: 8, color: 'var(--muted)' }}>
              {draft.cityCoords.lat.toFixed(4)}, {draft.cityCoords.lng.toFixed(4)}
            </span>
          </span>
          <button
            onClick={() => {
              setQuery('');
              set('cityCoords', undefined as unknown as CityCoords);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            clear
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Popular Nearby — OSM POIs around the picked centre
// ─────────────────────────────────────────────────────────────────────

interface PopularNearbyProps {
  centre: CityCoords;
  stopIds: string[];
  onAdd?: (s: SuggestedStop) => void;
}

function PopularNearby({ centre, stopIds, onAdd }: PopularNearbyProps) {
  const [pois, setPois] = useState<Poi[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const taken = useMemo(() => new Set(stopIds), [stopIds]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setPois(null);
    setError(null);
    fetchNearbyPois(centre.lat, centre.lng, {
      radius: 1800,
      limit: 8,
      signal: controller.signal,
    })
      .then((p) => {
        if (cancelled) return;
        setPois(p);
      })
      .catch((e) => {
        if (cancelled || (e as Error).name === 'AbortError') return;
        setError((e as Error).message);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [centre.lat, centre.lng]);

  const headerLabel = `Popular in ${centre.shortLabel}`;
  return (
    <div style={{ marginTop: 22 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <div className="label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {headerLabel}
          {pois && (
            <span
              className="mono"
              style={{
                fontSize: 9.5,
                letterSpacing: '0.08em',
                color: 'var(--muted-2)',
                background: 'var(--bg-2)',
                padding: '2px 7px',
                borderRadius: 999,
              }}
            >
              from osm
            </span>
          )}
        </div>
        {pois && pois.length > 0 && (
          <span
            className="mono"
            style={{
              fontSize: 10.5,
              color: 'var(--muted)',
              letterSpacing: '0.08em',
            }}
          >
            tap to add to your stops
          </span>
        )}
      </div>

      {pois == null && !error && (
        <div
          style={{
            padding: '24px 14px',
            border: '1px dashed var(--line-2)',
            borderRadius: 'var(--r-md)',
            background: 'var(--bg-2)',
            fontSize: 12,
            color: 'var(--muted)',
            textAlign: 'center',
          }}
        >
          fetching landmarks near {centre.shortLabel}…
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '12px 14px',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-md)',
            fontSize: 12,
            color: 'var(--terra)',
          }}
        >
          Couldn't reach OSM. {error}
        </div>
      )}

      {pois && pois.length === 0 && (
        <div
          style={{
            padding: '14px',
            border: '1px dashed var(--line-2)',
            borderRadius: 'var(--r-md)',
            fontSize: 12,
            color: 'var(--muted)',
            textAlign: 'center',
          }}
        >
          No tagged POIs near {centre.shortLabel}. Use the AI Regenerate
          button below to draft stops anyway.
        </div>
      )}

      {pois && pois.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          {pois.map((p) => {
            const id = 'osm-' + p.id;
            const inUse = taken.has(id);
            return (
              <button
                key={p.id}
                disabled={!onAdd || inUse}
                onClick={() => {
                  if (!onAdd) return;
                  onAdd({
                    id,
                    lat: p.lat,
                    lng: p.lng,
                    name: p.name,
                    type: p.kind.label,
                    time: '15m',
                    chosen: true,
                    blurb: `${p.kind.label} near ${centre.shortLabel} (tagged ${p.rawTag} on OSM).`,
                    tag: p.kind.label,
                  });
                }}
                className="card"
                style={{
                  padding: 14,
                  cursor: onAdd && !inUse ? 'pointer' : 'default',
                  background: inUse ? 'var(--bg-2)' : 'var(--paper)',
                  border: '1px solid var(--line)',
                  opacity: inUse ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: inUse ? 'var(--bg-2)' : 'var(--terra-soft)',
                    border: '1px solid var(--line-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--terra)',
                    flexShrink: 0,
                  }}
                >
                  <Icon name={p.kind.icon} size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    className="serif"
                    style={{
                      fontSize: 16,
                      lineHeight: 1.15,
                      color: 'var(--ink)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.name}
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 10,
                      color: 'var(--muted)',
                      letterSpacing: '0.05em',
                      marginTop: 2,
                    }}
                  >
                    {p.kind.label}
                  </div>
                </div>
                <span
                  className="chip chip-mono"
                  style={{
                    fontSize: 9.5,
                    padding: '2px 7px',
                    background: 'var(--bg-2)',
                  }}
                >
                  {inUse ? 'added' : '+ add'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

import type { IconName } from '../../Icon';

function iconForKind(kind: string): IconName {
  switch (kind) {
    case 'city':
    case 'town':
    case 'village':
      return 'map';
    case 'suburb':
    case 'neighbourhood':
    case 'quarter':
    case 'city_district':
      return 'pin';
    case 'road':
    case 'street':
      return 'route';
    case 'house':
    case 'amenity':
    case 'shop':
      return 'pin';
    default:
      return 'search';
  }
}
