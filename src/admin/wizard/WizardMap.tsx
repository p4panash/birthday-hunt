// Real OSM tile map for the wizard's Step 05 — Pick the stops.
//
// Pure Leaflet (no react-leaflet wrapper). The component owns the map
// instance via a ref and reconciles markers / route line on prop changes.
// Reused stop shape: { lat, lng, name, order }.

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { SuggestedStop } from './data';
import { CITY_CENTERS, type CityId } from './data';

interface Props {
  city: CityId;
  stops: SuggestedStop[];
  suggestions: SuggestedStop[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onAddSuggestion: (id: string) => void;
}

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR =
  '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>';

// Numbered orange pin for chosen stops. Larger + pulsing when selected.
function chosenIcon(order: number, selected: boolean): L.DivIcon {
  const size = selected ? 36 : 28;
  return L.divIcon({
    className: 'wiz-chosen-pin' + (selected ? ' wiz-selected' : ''),
    html: `<div class="dot"><span>${order}</span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Dashed terracotta pin for AI suggestions not yet added to the route.
function ghostIcon(label: string): L.DivIcon {
  return L.divIcon({
    className: 'wiz-ghost-pin',
    html: `<div class="ring"></div><span class="lbl">${escapeHtml(label)}</span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default function WizardMap({
  city,
  stops,
  suggestions,
  selectedId,
  hoveredId,
  onSelect,
  onAddSuggestion,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);

  // One-time init.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const centre = CITY_CENTERS[city];
    const map = L.map(containerRef.current, {
      center: [centre.lat, centre.lng],
      zoom: centre.zoom,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: false,
    });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      routeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recentre when the picked city changes OR when the stops set obviously
  // points somewhere else (e.g. AI returned Baia Mare stops). We fit the
  // bounds of the chosen stops if there are any; otherwise fall back to
  // the city centre.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (stops.length > 0) {
      const bounds = L.latLngBounds(stops.map((s) => [s.lat, s.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else {
      const c = CITY_CENTERS[city];
      map.setView([c.lat, c.lng], c.zoom);
    }
  }, [city, stops]);

  // Reconcile markers + route line on every render.
  useEffect(() => {
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();

    // Route line in terra tone, drawn first so pins sit on top.
    if (stops.length >= 2) {
      const line = L.polyline(
        stops.map((s) => [s.lat, s.lng]),
        {
          color: 'oklch(0.62 0.14 40)',
          weight: 3,
          opacity: 0.7,
          dashArray: undefined,
        },
      ).addTo(layer);
      routeRef.current = line;
    }

    // Chosen stops.
    for (const s of stops) {
      const selected = selectedId === s.id || hoveredId === s.id;
      const m = L.marker([s.lat, s.lng], {
        icon: chosenIcon(s.order ?? 0, selected),
        title: s.name,
        keyboard: false,
      });
      m.on('click', () => onSelect(s.id));
      m.addTo(layer);
    }

    // Suggestions (ghost markers).
    for (const s of suggestions.slice(0, 4)) {
      const m = L.marker([s.lat, s.lng], {
        icon: ghostIcon(s.name.toLowerCase().split(' ')[0]),
        title: s.name,
        keyboard: false,
      });
      m.on('click', () => onAddSuggestion(s.id));
      m.addTo(layer);
    }
  }, [stops, suggestions, selectedId, hoveredId, onSelect, onAddSuggestion]);

  return (
    <>
      <style>{PIN_STYLES}</style>
      <div
        ref={containerRef}
        data-testid="wizard-map"
        style={{
          width: '100%',
          height: '100%',
          background: 'oklch(0.96 0.012 80)',
        }}
      />
    </>
  );
}

const PIN_STYLES = `
.wiz-chosen-pin {
  display: flex;
  align-items: center;
  justify-content: center;
}
.wiz-chosen-pin .dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: oklch(0.62 0.14 40);
  border: 2.5px solid white;
  box-shadow: 0 2px 6px rgba(0,0,0,0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  font-weight: 600;
  transition: width 120ms, height 120ms;
}
.wiz-chosen-pin.wiz-selected .dot {
  width: 36px;
  height: 36px;
  font-size: 14px;
  box-shadow: 0 0 0 6px oklch(0.62 0.14 40 / 0.25), 0 4px 12px rgba(0,0,0,0.2);
}
.wiz-ghost-pin {
  position: relative;
}
.wiz-ghost-pin .ring {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  border: 1.5px dashed oklch(0.62 0.14 40);
  position: relative;
}
.wiz-ghost-pin .ring::before,
.wiz-ghost-pin .ring::after {
  content: '';
  position: absolute;
  background: oklch(0.62 0.14 40);
}
.wiz-ghost-pin .ring::before {
  left: 4px; right: 4px; top: 50%; height: 1.5px; transform: translateY(-50%);
}
.wiz-ghost-pin .ring::after {
  top: 4px; bottom: 4px; left: 50%; width: 1.5px; transform: translateX(-50%);
}
.wiz-ghost-pin .lbl {
  position: absolute;
  top: -22px;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border: 1px solid oklch(0.90 0.008 60);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 10px;
  font-family: "JetBrains Mono", monospace;
  font-weight: 500;
  color: oklch(0.62 0.14 40);
  white-space: nowrap;
  letter-spacing: 0.05em;
  pointer-events: none;
}
`;
