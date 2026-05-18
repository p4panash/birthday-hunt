import { motion } from 'motion/react';
import { config } from '../config';
import type { GeoStatus, WarmthTier } from '../geo/useGeoWatch';

type Props = {
  status: GeoStatus;
  tier: WarmthTier;
};

/**
 * A derpy wobbling blob that gets visibly more excited as the friend closes
 * in. Lives where the smooth-dot "warmth pulse" was in the UX research doc.
 * Phase 5 swaps the inline SVG for the proper <Mascot> component; this is
 * the placeholder embodiment of the same idea.
 */
export default function WarmthPulse({ status, tier }: Props) {
  const wobble = wobbleForTier(tier);
  const blobScale = scaleForTier(tier);

  return (
    <div className="warmth" aria-live="polite">
      <motion.div
        className="warmth__blob"
        animate={{
          rotate: [-wobble.deg, wobble.deg, -wobble.deg],
          scale: [blobScale, blobScale * 1.04, blobScale],
        }}
        transition={{
          duration: wobble.dur,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <BlobSvg tier={tier} />
      </motion.div>
      <p className="warmth__status">{statusText(status, tier)}</p>
    </div>
  );
}

function wobbleForTier(tier: WarmthTier): { deg: number; dur: number } {
  switch (tier) {
    case 'onTop':   return { deg: 8, dur: 0.45 };
    case 'close':   return { deg: 5, dur: 0.9 };
    case 'far':     return { deg: 3, dur: 1.6 };
    case 'veryFar': return { deg: 2, dur: 2.6 };
    case 'unknown': return { deg: 1.5, dur: 3.0 };
  }
}

function scaleForTier(tier: WarmthTier): number {
  switch (tier) {
    case 'onTop':   return 1.08;
    case 'close':   return 1.03;
    case 'far':     return 1.0;
    case 'veryFar': return 0.95;
    case 'unknown': return 0.9;
  }
}

function statusText(status: GeoStatus, tier: WarmthTier): string {
  if (status === 'denied') return config.errors.gpsDenied;
  if (status === 'unavailable') return 'no GPS on this device.';
  if (status === 'error') return config.errors.gpsFlaky;
  if (status === 'idle') return '...';
  switch (tier) {
    case 'onTop':   return config.warmthStatuses.onTop;
    case 'close':   return config.warmthStatuses.close;
    case 'far':     return config.warmthStatuses.far;
    case 'veryFar': return config.warmthStatuses.veryFar;
    case 'unknown': return '...';
  }
}

/**
 * Inline derpy blob — a coral squish with googly eyes. Asymmetric on purpose.
 * Eyes grow with the tier.
 */
function BlobSvg({ tier }: { tier: WarmthTier }) {
  const eyeSize = eyeSizeForTier(tier);
  return (
    <svg viewBox="0 0 160 160" width="160" height="160" aria-hidden>
      {/* body — wobbly oval, intentionally off-center */}
      <path
        d="M 80 18 C 122 14, 146 50, 144 88 C 142 124, 110 148, 76 144 C 36 140, 12 108, 18 70 C 22 38, 50 22, 80 18 Z"
        fill="var(--coral)"
        stroke="#1a0e26"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* left eye white */}
      <ellipse cx="58" cy="72" rx={eyeSize.rx} ry={eyeSize.ry} fill="var(--cream)" stroke="#1a0e26" strokeWidth="2.5" />
      {/* right eye white (slightly different shape — asymmetric) */}
      <ellipse cx="104" cy="68" rx={eyeSize.rx + 1} ry={eyeSize.ry} fill="var(--cream)" stroke="#1a0e26" strokeWidth="2.5" />
      {/* pupils */}
      <circle cx={58 + eyeSize.pupilOffsetX} cy={72 + eyeSize.pupilOffsetY} r="4" fill="#1a0e26" />
      <circle cx={104 + eyeSize.pupilOffsetX} cy={68 + eyeSize.pupilOffsetY} r="4" fill="#1a0e26" />
      {/* mouth — derpy small line that gets wider with tier */}
      <path
        d={mouthPath(tier)}
        fill="none"
        stroke="#1a0e26"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function eyeSizeForTier(tier: WarmthTier): {
  rx: number; ry: number; pupilOffsetX: number; pupilOffsetY: number;
} {
  switch (tier) {
    case 'onTop':   return { rx: 12, ry: 14, pupilOffsetX: 0, pupilOffsetY: 0 };
    case 'close':   return { rx: 10, ry: 12, pupilOffsetX: 1, pupilOffsetY: -1 };
    case 'far':     return { rx: 8, ry: 10, pupilOffsetX: 0, pupilOffsetY: 0 };
    case 'veryFar': return { rx: 7, ry: 7, pupilOffsetX: -1, pupilOffsetY: 1 };
    case 'unknown': return { rx: 6, ry: 6, pupilOffsetX: 0, pupilOffsetY: 2 };
  }
}

function mouthPath(tier: WarmthTier): string {
  switch (tier) {
    case 'onTop':   return 'M 64 108 Q 80 130, 100 108';
    case 'close':   return 'M 66 110 Q 82 122, 100 110';
    case 'far':     return 'M 70 114 Q 82 118, 96 114';
    case 'veryFar': return 'M 72 116 L 96 116';
    case 'unknown': return 'M 72 118 Q 82 114, 96 118';
  }
}
