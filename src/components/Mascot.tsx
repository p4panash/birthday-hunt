import { motion } from 'motion/react';

export type MascotExpression = 'idle' | 'excited' | 'wrong-code' | 'celebrating';

type Props = {
  expression?: MascotExpression;
  size?: number;
  wobble?: boolean;
};

/**
 * Derpy coral blob with googly eyes. Single hand-drawn SVG; expressions swap
 * eye and mouth fragments. Intentionally asymmetric. If it ever looks
 * "designed," it's broken — see master plan §2.4.
 */
export default function Mascot({
  expression = 'idle',
  size = 120,
  wobble = true,
}: Props) {
  const cfg = expressions[expression];

  return (
    <motion.svg
      viewBox="0 0 160 160"
      width={size}
      height={size}
      role="img"
      aria-label="hunt mascot"
      animate={wobble ? { rotate: [-cfg.wobbleDeg, cfg.wobbleDeg, -cfg.wobbleDeg] } : {}}
      transition={{
        duration: cfg.wobbleDur,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      style={{ filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.35))' }}
    >
      {/* body — same wobbly oval, intentionally off-center, every expression */}
      <path
        d="M 80 18 C 122 14, 146 50, 144 88 C 142 124, 110 148, 76 144 C 36 140, 12 108, 18 70 C 22 38, 50 22, 80 18 Z"
        fill="var(--coral)"
        stroke="#1a0e26"
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* eyes — fragment swaps with expression */}
      <Eyes kind={cfg.eyes} />

      {/* mouth */}
      <path
        d={cfg.mouth}
        fill={cfg.mouthFill ?? 'none'}
        stroke="#1a0e26"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* optional sweat drops or sparkle dots */}
      {cfg.extras}
    </motion.svg>
  );
}

function Eyes({ kind }: { kind: EyesKind }) {
  switch (kind) {
    case 'normal':
      return (
        <>
          <ellipse cx="58" cy="72" rx="9" ry="11" fill="var(--cream)" stroke="#1a0e26" strokeWidth="2.5" />
          <ellipse cx="105" cy="68" rx="10" ry="11" fill="var(--cream)" stroke="#1a0e26" strokeWidth="2.5" />
          <circle cx="58" cy="72" r="4" fill="#1a0e26" />
          <circle cx="106" cy="68" r="4" fill="#1a0e26" />
        </>
      );
    case 'wide':
      return (
        <>
          <ellipse cx="58" cy="70" rx="13" ry="14" fill="var(--cream)" stroke="#1a0e26" strokeWidth="2.5" />
          <ellipse cx="106" cy="66" rx="14" ry="14" fill="var(--cream)" stroke="#1a0e26" strokeWidth="2.5" />
          <circle cx="58" cy="71" r="5" fill="#1a0e26" />
          <circle cx="106" cy="67" r="5" fill="#1a0e26" />
        </>
      );
    case 'happy':
      // ^_^
      return (
        <>
          <path
            d="M 48 72 Q 58 60, 68 72"
            fill="none"
            stroke="#1a0e26"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M 96 68 Q 106 56, 116 68"
            fill="none"
            stroke="#1a0e26"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </>
      );
    case 'x':
      // X_X
      return (
        <>
          <path d="M 50 64 L 66 80 M 66 64 L 50 80" stroke="#1a0e26" strokeWidth="4" strokeLinecap="round" />
          <path d="M 98 60 L 114 76 M 114 60 L 98 76" stroke="#1a0e26" strokeWidth="4" strokeLinecap="round" />
        </>
      );
  }
}

type EyesKind = 'normal' | 'wide' | 'happy' | 'x';

type ExpressionConfig = {
  eyes: EyesKind;
  mouth: string;
  mouthFill?: string;
  wobbleDeg: number;
  wobbleDur: number;
  extras?: React.ReactNode;
};

const expressions: Record<MascotExpression, ExpressionConfig> = {
  idle: {
    eyes: 'normal',
    mouth: 'M 70 114 Q 82 122, 96 114',
    wobbleDeg: 2,
    wobbleDur: 1.6,
  },
  excited: {
    eyes: 'wide',
    mouth: 'M 60 108 Q 82 132, 104 108',
    wobbleDeg: 5,
    wobbleDur: 0.55,
    extras: (
      <>
        <circle cx="30" cy="42" r="3" fill="var(--cream)" />
        <circle cx="138" cy="38" r="2.5" fill="var(--cream)" />
        <circle cx="22" cy="100" r="2" fill="var(--cream)" />
      </>
    ),
  },
  'wrong-code': {
    eyes: 'x',
    mouth: 'M 64 116 L 100 110',
    wobbleDeg: 6,
    wobbleDur: 0.2,
  },
  celebrating: {
    eyes: 'happy',
    mouth: 'M 56 100 Q 82 144, 108 100 Q 96 122, 82 124 Q 68 122, 56 100 Z',
    mouthFill: '#1a0e26',
    wobbleDeg: 8,
    wobbleDur: 0.4,
    extras: (
      <>
        <path d="M 16 28 L 24 36 M 24 28 L 16 36" stroke="var(--cream)" strokeWidth="3" strokeLinecap="round" />
        <path d="M 134 24 L 142 32 M 142 24 L 134 32" stroke="var(--cream)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="22" cy="70" r="3" fill="var(--cream)" />
        <circle cx="140" cy="100" r="3" fill="var(--cream)" />
        <path d="M 8 132 L 14 138 M 14 132 L 8 138" stroke="var(--coral-soft)" strokeWidth="3" strokeLinecap="round" />
      </>
    ),
  },
};
