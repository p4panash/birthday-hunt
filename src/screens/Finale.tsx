import { useEffect } from 'react';
import { motion } from 'motion/react';
import { config } from '../config';
import { bigBurst } from '../lib/confettiBurst';
import { playFinale } from '../lib/sounds';
import Mascot from '../components/Mascot';
import type { HuntAction } from '../state/huntReducer';

type Props = { dispatch: React.Dispatch<HuntAction> };

const QR_SRC = `${import.meta.env.BASE_URL}qr.png`;

/**
 * Finale screen. Per master plan §2.4 / §7 of UX doc: the assembled QR
 * appears via a crash-zoom, the mascot pops in celebrating, big confetti.
 *
 * We trigger:
 *   • The finale sound (Phase 7 plumbs the actual <audio>; here it's a no-op
 *     hook into the bigBurst call so the rhythm is right).
 *   • bigBurst() once on mount.
 */
export default function Finale({ dispatch }: Props) {
  const { finale } = config;

  useEffect(() => {
    // Sync with the QR scale-in animation peak (~1.5s after mount).
    const tSound = setTimeout(() => playFinale(), 1400);
    const tBurst = setTimeout(() => bigBurst(), 1500);
    return () => {
      clearTimeout(tSound);
      clearTimeout(tBurst);
    };
  }, []);

  return (
    <section className="screen screen--finale">
      <motion.h1
        className="finale__headline"
        initial={{ scale: 0.4, opacity: 0, rotate: -6 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 16, delay: 0.1 }}
      >
        {finale.headline}
      </motion.h1>

      <motion.div
        className="qr-card"
        initial={{ scale: 0.15, rotate: -25, opacity: 0 }}
        animate={{ scale: [0.15, 1.15, 0.95, 1.02, 1], rotate: [-25, 8, -3, 1, 0], opacity: 1 }}
        transition={{ duration: 1.2, ease: [0.34, 1.6, 0.64, 1], delay: 0.25 }}
      >
        <img src={QR_SRC} alt="EasyBox QR" draggable={false} />
        <motion.div
          className="qr-card__scanline"
          initial={{ y: '-100%' }}
          animate={{ y: '100%' }}
          transition={{ duration: 0.8, delay: 1.6, ease: 'linear' }}
          aria-hidden
        />
      </motion.div>

      <motion.div
        className="finale__mascot"
        initial={{ scale: 0, rotate: -180 }}
        animate={{
          scale: [0, 1.3, 0.95, 1.08, 1],
          rotate: [-180, 12, -8, 4, 0],
          y: [0, -6, 0],
        }}
        transition={{
          duration: 0.9,
          ease: [0.34, 1.8, 0.64, 1],
          delay: 0.9,
          y: { duration: 0.5, repeat: Infinity, repeatType: 'mirror', delay: 1.6 },
        }}
        aria-hidden
      >
        <Mascot expression="celebrating" size={120} />
      </motion.div>

      <p className="finale__instruction">{finale.instruction}</p>
      <p className="fine-print">{finale.qrBrightnessTip}</p>

      <button className="dev-skip" onClick={() => dispatch({ type: 'RESET' })}>
        (dev) reset
      </button>
    </section>
  );
}
