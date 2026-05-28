// Mini Leaflet map showing self + teammates + pings, scoped to the active
// LocationActive screen. Lazy-loaded so Leaflet (~38 KB gz) only enters the
// bundle when a player is actually mid-hunt.

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PlayerPresence } from 'shared/messages';
import type { ActivePing } from '../lib/useTeamState';
import { haversineMeters } from '../geo/haversine';

interface Props {
  selfPlayerId: string;
  selfLat: number | null;
  selfLng: number | null;
  presence: PlayerPresence[];
  pings: ActivePing[];
  /** Active checkpoint coordinates; shown only when `showCheckpoint` is true. */
  checkpoint: { lat: number; lng: number };
  /** Render the orange 🎯 checkpoint marker (set to true when warmth=onTop). */
  showCheckpoint: boolean;
  onMapTap: (lat: number, lng: number) => void;
}

const MAP_HEIGHT_PX = 200;
const TILE_URL =
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>';

export default function TeamMap({
  selfPlayerId,
  selfLat,
  selfLng,
  presence,
  pings,
  checkpoint,
  showCheckpoint,
  onMapTap,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const selfMarkerRef = useRef<L.Marker | null>(null);
  const teammateLayerRef = useRef<L.LayerGroup | null>(null);
  const pingLayerRef = useRef<L.LayerGroup | null>(null);
  const checkpointMarkerRef = useRef<L.Marker | null>(null);
  const onMapTapRef = useRef(onMapTap);

  useEffect(() => {
    onMapTapRef.current = onMapTap;
  }, [onMapTap]);

  // Initial map setup (once).
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const initialCenter: L.LatLngExpression =
      selfLat != null && selfLng != null
        ? [selfLat, selfLng]
        : [checkpoint.lat, checkpoint.lng];
    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: 16,
      minZoom: 14,
      maxZoom: 18,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);
    teammateLayerRef.current = L.layerGroup().addTo(map);
    pingLayerRef.current = L.layerGroup().addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      onMapTapRef.current(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Run once; map doesn't recreate on every prop change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Self marker (blue dot) + auto-pan when position changes meaningfully.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || selfLat == null || selfLng == null) return;
    if (!selfMarkerRef.current) {
      selfMarkerRef.current = L.marker([selfLat, selfLng], {
        icon: makeDivIcon('bday-self-marker', '<div></div>'),
        interactive: false,
        keyboard: false,
      }).addTo(map);
      map.panTo([selfLat, selfLng], { animate: false });
    } else {
      selfMarkerRef.current.setLatLng([selfLat, selfLng]);
    }
  }, [selfLat, selfLng]);

  // Teammate markers (green dots + name + distance).
  useEffect(() => {
    const layer = teammateLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const p of presence) {
      if (p.playerId === selfPlayerId) continue;
      if (p.lat == null || p.lng == null) continue;
      const dist =
        selfLat != null && selfLng != null
          ? haversineMeters(selfLat, selfLng, p.lat, p.lng)
          : null;
      const labelText = dist != null
        ? `${p.name || 'teammate'} · ${formatDistance(dist)}`
        : p.name || 'teammate';
      L.marker([p.lat, p.lng], {
        icon: makeDivIcon(
          'bday-teammate-marker',
          `<div></div><span class="lbl">${escapeHtml(labelText)}</span>`,
        ),
        interactive: false,
        keyboard: false,
      }).addTo(layer);
    }
  }, [presence, selfPlayerId, selfLat, selfLng]);

  // Ping markers (yellow pulse + sender name).
  useEffect(() => {
    const layer = pingLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const p of pings) {
      L.marker([p.lat, p.lng], {
        icon: makeDivIcon(
          'bday-ping-marker',
          `<div class="pulse"></div>` +
            (p.sender_name
              ? `<span class="lbl">${escapeHtml(p.sender_name)}</span>`
              : ''),
        ),
        interactive: false,
        keyboard: false,
      }).addTo(layer);
    }
  }, [pings]);

  // Checkpoint marker — only when player is on top.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (showCheckpoint) {
      if (!checkpointMarkerRef.current) {
        checkpointMarkerRef.current = L.marker(
          [checkpoint.lat, checkpoint.lng],
          {
            icon: makeDivIcon('bday-checkpoint-marker', '🎯'),
            interactive: false,
            keyboard: false,
          },
        ).addTo(map);
      } else {
        checkpointMarkerRef.current.setLatLng([checkpoint.lat, checkpoint.lng]);
      }
    } else if (checkpointMarkerRef.current) {
      map.removeLayer(checkpointMarkerRef.current);
      checkpointMarkerRef.current = null;
    }
  }, [showCheckpoint, checkpoint.lat, checkpoint.lng]);

  // Inline marker styles. Kept here (not in a CSS file) so the component is
  // single-file and tree-shakes cleanly with the rest of the lazy chunk.
  return (
    <>
      <style>{MARKER_STYLES}</style>
      <div
        ref={containerRef}
        data-testid="team-map"
        style={{
          width: '100%',
          maxWidth: 360,
          height: MAP_HEIGHT_PX,
          margin: '12px auto',
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid rgba(255, 216, 156, 0.18)',
          touchAction: 'manipulation',
        }}
      />
    </>
  );
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function makeDivIcon(className: string, html: string): L.DivIcon {
  return L.divIcon({
    className,
    html,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

const MARKER_STYLES = `
.bday-self-marker > div {
  width: 14px; height: 14px; border-radius: 50%;
  background: #4ea3ff; border: 2px solid #fff;
  box-shadow: 0 0 0 3px rgba(78, 163, 255, 0.3);
}
.bday-teammate-marker { display: flex; align-items: center; gap: 4px; white-space: nowrap; }
.bday-teammate-marker > div {
  width: 12px; height: 12px; border-radius: 50%;
  background: #9BD89C; border: 2px solid #fff;
  box-shadow: 0 0 0 2px rgba(155, 216, 156, 0.3);
  flex-shrink: 0;
}
.bday-teammate-marker .lbl {
  background: rgba(31, 20, 48, 0.85); color: #FFD89C;
  font-size: 10px; padding: 1px 6px; border-radius: 6px;
  pointer-events: none;
}
.bday-ping-marker .pulse {
  width: 16px; height: 16px; border-radius: 50%;
  background: rgba(255, 215, 80, 0.7);
  border: 2px solid #FFC83D;
  animation: bday-ping-pulse 1.4s ease-out infinite;
}
.bday-ping-marker { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.bday-ping-marker .lbl {
  background: rgba(31, 20, 48, 0.85); color: #FFD89C;
  font-size: 9px; padding: 1px 5px; border-radius: 5px;
  pointer-events: none;
}
.bday-checkpoint-marker {
  font-size: 22px; line-height: 1;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
}
@keyframes bday-ping-pulse {
  0% { transform: scale(0.6); opacity: 1; }
  100% { transform: scale(2.0); opacity: 0; }
}
`;
