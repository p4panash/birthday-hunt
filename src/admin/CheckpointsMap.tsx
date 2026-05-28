// Read-only Leaflet map for the hunt detail page. Renders the 3
// checkpoints from a HuntConfig with numbered pins, a route line, and
// a radius ring around each pin so admins can eyeball whether stops
// overlap geographically.

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Checkpoint } from 'shared/config/types';

interface Props {
  checkpoints: Checkpoint[];
  height?: number;
}

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR =
  '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>';

function pinIcon(n: number): L.DivIcon {
  return L.divIcon({
    className: 'hd-checkpoint-pin',
    html: `<div class="dot"><span>${n}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

export default function CheckpointsMap({ checkpoints, height = 280 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [46.77, 23.6],
      zoom: 14,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (checkpoints.length === 0) return;

    // Radius circles + numbered pins + route line.
    for (const c of checkpoints) {
      L.circle([c.lat, c.lng], {
        radius: c.radiusMeters,
        color: 'oklch(0.62 0.14 40)',
        fillColor: 'oklch(0.62 0.14 40)',
        fillOpacity: 0.08,
        weight: 1,
      }).addTo(layer);
      L.marker([c.lat, c.lng], {
        icon: pinIcon(c.id),
        title: c.name,
      }).addTo(layer);
    }
    if (checkpoints.length >= 2) {
      L.polyline(
        checkpoints.map((c) => [c.lat, c.lng]),
        {
          color: 'oklch(0.62 0.14 40)',
          weight: 3,
          opacity: 0.7,
        },
      ).addTo(layer);
    }
    map.fitBounds(
      L.latLngBounds(checkpoints.map((c) => [c.lat, c.lng] as [number, number])),
      { padding: [40, 40], maxZoom: 16 },
    );
  }, [checkpoints]);

  return (
    <>
      <style>{`
        .hd-checkpoint-pin { display: flex; align-items: center; justify-content: center; }
        .hd-checkpoint-pin .dot {
          width: 28px; height: 28px; border-radius: 50%;
          background: oklch(0.62 0.14 40); border: 2.5px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.18);
          display: flex; align-items: center; justify-content: center;
          color: white; font-family: "JetBrains Mono", monospace;
          font-size: 12px; font-weight: 600;
        }
      `}</style>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height,
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid var(--line)',
          background: 'oklch(0.96 0.012 80)',
        }}
      />
    </>
  );
}
