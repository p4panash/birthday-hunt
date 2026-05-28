// Stylized abstract city map — warm-tone, no real tiles. Pins are positioned
// in the 1000x700 viewBox so they scale fluidly with the map area.
//
// Ported from the design-canvas prototype; reusable for the Kickoff
// background (faint), the City step, and the Map step.

import type { CSSProperties, ReactNode } from 'react';

const MAP_TONE = {
  light: {
    land: 'oklch(0.962 0.012 80)',
    water: 'oklch(0.88 0.025 220)',
    park: 'oklch(0.90 0.05 145)',
    road: 'oklch(0.84 0.010 70)',
    roadMinor: 'oklch(0.88 0.008 75)',
    blockA: 'oklch(0.94 0.010 75)',
    blockB: 'oklch(0.92 0.014 70)',
    label: 'oklch(0.55 0.015 60)',
  },
};

interface MapCanvasProps {
  tone?: 'light';
  showLabels?: boolean;
  density?: number;
  children?: ReactNode;
  style?: CSSProperties;
}

export function MapCanvas({
  tone = 'light',
  showLabels = true,
  density = 1,
  children,
  style,
}: MapCanvasProps) {
  const t = MAP_TONE[tone] ?? MAP_TONE.light;
  return (
    <svg
      viewBox="0 0 1000 700"
      preserveAspectRatio="xMidYMid slice"
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        background: t.land,
        ...style,
      }}
    >
      <defs>
        <pattern
          id="mapHatch"
          patternUnits="userSpaceOnUse"
          width="6"
          height="6"
          patternTransform="rotate(45)"
        >
          <rect width="6" height="6" fill={t.land} />
          <line x1="0" y1="0" x2="0" y2="6" stroke={t.roadMinor} strokeWidth="1" />
        </pattern>
      </defs>

      {/* Park / green areas */}
      <path
        d="M 80 480 Q 140 440 220 460 Q 300 480 330 540 Q 320 600 240 600 Q 130 590 80 540 Z"
        fill={t.park}
        opacity="0.7"
      />
      <path
        d="M 700 90 Q 820 70 880 130 Q 900 200 830 220 Q 740 220 700 170 Z"
        fill={t.park}
        opacity="0.7"
      />

      {/* River */}
      <path
        d="M -20 320 Q 180 280 380 340 Q 580 400 780 360 Q 920 340 1020 380"
        stroke={t.water}
        strokeWidth="22"
        fill="none"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M -20 320 Q 180 280 380 340 Q 580 400 780 360 Q 920 340 1020 380"
        stroke="oklch(0.93 0.018 220)"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />

      {/* Soft block fills — districts */}
      <g opacity="0.9">
        <rect x="120" y="100" width="160" height="120" fill={t.blockA} rx="3" />
        <rect x="300" y="80" width="180" height="160" fill={t.blockB} rx="3" />
        <rect x="500" y="120" width="160" height="110" fill={t.blockA} rx="3" />
        <rect x="120" y="240" width="180" height="60" fill={t.blockB} rx="3" />
        <rect x="320" y="260" width="200" height="50" fill={t.blockA} rx="3" />
        <rect x="560" y="240" width="180" height="60" fill={t.blockB} rx="3" />
        <rect x="80" y="380" width="200" height="80" fill={t.blockA} rx="3" />
        <rect x="380" y="430" width="180" height="80" fill={t.blockB} rx="3" />
        <rect x="620" y="400" width="170" height="100" fill={t.blockA} rx="3" />
        <rect x="100" y="620" width="160" height="60" fill={t.blockB} rx="3" />
        <rect x="290" y="630" width="220" height="50" fill={t.blockA} rx="3" />
        <rect x="540" y="620" width="200" height="60" fill={t.blockB} rx="3" />
        <rect x="780" y="500" width="180" height="120" fill={t.blockA} rx="3" />
      </g>

      {/* Major roads */}
      <g stroke={t.road} fill="none" strokeLinecap="round">
        <path d="M -10 200 Q 200 210 400 200 Q 600 190 1010 220" strokeWidth="4" />
        <path d="M -10 600 Q 200 580 400 590 Q 600 600 1010 580" strokeWidth="4" />
        <path d="M 290 -10 Q 300 200 290 360 Q 280 500 300 710" strokeWidth="3.5" />
        <path d="M 740 -10 Q 740 200 740 380 Q 740 540 750 710" strokeWidth="3.5" />
        <path d="M 500 -10 Q 510 180 500 360 Q 500 540 510 710" strokeWidth="2.6" />
      </g>
      {/* Minor roads */}
      <g
        stroke={t.roadMinor}
        fill="none"
        strokeLinecap="round"
        strokeWidth="1.5"
        opacity={0.9 * density}
      >
        <path d="M 80 -10 Q 90 200 80 380 Q 80 540 90 710" />
        <path d="M 880 -10 Q 880 200 880 380 Q 880 540 890 710" />
        <path d="M -10 100 Q 200 110 500 100 Q 700 95 1010 110" />
        <path d="M -10 480 Q 200 490 500 470 Q 700 475 1010 490" />
        <path d="M -10 680 L 1010 680" />
        <path d="M 400 -10 L 400 710" />
        <path d="M 620 -10 L 620 710" />
        <path d="M 200 -10 L 200 710" />
      </g>

      {showLabels && (
        <g
          fontFamily="Geist, sans-serif"
          fontSize="11"
          fill={t.label}
          opacity="0.7"
          textAnchor="middle"
        >
          <text x="200" y="155" letterSpacing="0.05em">CENTRU</text>
          <text x="400" y="155" letterSpacing="0.05em">PIAȚA UNIRII</text>
          <text x="600" y="180" letterSpacing="0.05em">CETĂȚUIE</text>
          <text x="190" y="430" letterSpacing="0.05em">GHEORGHENI</text>
          <text x="700" y="450" letterSpacing="0.05em">MĂRĂȘTI</text>
          <text x="400" y="660" letterSpacing="0.05em">MĂNĂȘTUR</text>
          <text x="860" y="555" letterSpacing="0.05em">IRIS</text>
          <text
            x="180"
            y="295"
            fill="oklch(0.55 0.05 220)"
            fontStyle="italic"
            fontFamily="Instrument Serif"
            fontSize="14"
          >
            Someșul Mic
          </text>
        </g>
      )}

      {children}
    </svg>
  );
}

interface MapPinProps {
  x: number;
  y: number;
  n: number;
  label?: string | null;
  color?: string;
  dim?: boolean;
  large?: boolean;
  pulse?: boolean;
  onClick?: () => void;
  sublabel?: string;
}

export function MapPin({
  x,
  y,
  n,
  label,
  color = 'var(--terra)',
  dim = false,
  large = false,
  pulse = false,
  onClick,
  sublabel,
}: MapPinProps) {
  const r = large ? 18 : 14;
  const op = dim ? 0.45 : 1;
  return (
    <g
      transform={`translate(${x},${y})`}
      style={{ cursor: onClick ? 'pointer' : 'default', opacity: op }}
      onClick={onClick}
    >
      {pulse && <circle r={r} fill={color} opacity="0.35" className="pulse-ring" />}
      <ellipse cx="0" cy="6" rx={r * 0.8} ry={r * 0.25} fill="rgba(35,28,20,0.18)" />
      <circle r={r} fill={color} stroke="white" strokeWidth="2.5" />
      <text
        textAnchor="middle"
        y="4"
        fill="white"
        fontSize={large ? 13 : 11}
        fontFamily="JetBrains Mono, monospace"
        fontWeight="600"
      >
        {n}
      </text>
      {label && (
        <g transform={`translate(${r + 6}, ${-r + 4})`}>
          <rect
            x="0"
            y="0"
            width={label.length * 7 + 14}
            height="24"
            rx="12"
            fill="white"
            stroke="oklch(0.90 0.008 60)"
            strokeWidth="1"
            filter="drop-shadow(0 2px 6px rgba(35,28,20,0.10))"
          />
          <text
            x="10"
            y="16"
            fill="oklch(0.20 0.012 50)"
            fontSize="11"
            fontFamily="Geist, sans-serif"
            fontWeight="500"
          >
            {label}
          </text>
        </g>
      )}
      {sublabel && (
        <text
          textAnchor="middle"
          y={r + 14}
          fill="oklch(0.20 0.012 50)"
          fontSize="10"
          fontFamily="Geist, sans-serif"
          fontWeight="500"
        >
          {sublabel}
        </text>
      )}
    </g>
  );
}

interface MapGhostPinProps {
  x: number;
  y: number;
  label?: string;
  onClick?: () => void;
}

export function MapGhostPin({ x, y, label, onClick }: MapGhostPinProps) {
  return (
    <g
      transform={`translate(${x},${y})`}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <circle
        r="14"
        fill="white"
        stroke="var(--terra)"
        strokeWidth="1.5"
        strokeDasharray="3 3"
        opacity="0.95"
      />
      <g stroke="var(--terra)" strokeWidth="1.5" strokeLinecap="round">
        <path d="M -4 0 L 4 0" />
        <path d="M 0 -4 L 0 4" />
      </g>
      {label && (
        <text
          textAnchor="middle"
          y="-22"
          fill="var(--terra)"
          fontSize="10"
          fontFamily="JetBrains Mono, monospace"
          fontWeight="500"
          letterSpacing="0.05em"
        >
          {label}
        </text>
      )}
    </g>
  );
}

interface MapRouteProps {
  points: [number, number][];
  color?: string;
  dashed?: boolean;
}

export function MapRoute({ points, color = 'var(--terra)', dashed = false }: MapRouteProps) {
  if (!points || points.length < 2) return null;
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    const mx = (px + x) / 2;
    const my = (py + y) / 2 - 20;
    d += ` Q ${mx} ${my} ${x} ${y}`;
  }
  return (
    <path
      d={d}
      stroke={color}
      strokeWidth="2.5"
      fill="none"
      strokeLinecap="round"
      strokeDasharray={dashed ? '5 6' : undefined}
      opacity="0.85"
    />
  );
}
