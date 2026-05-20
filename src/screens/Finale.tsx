import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { config } from '../config';
import { bigBurst } from '../lib/confettiBurst';
import { playFinale } from '../lib/sounds';
import Mascot from '../components/Mascot';
import type { HuntAction } from '../state/huntReducer';

type Props = { dispatch: React.Dispatch<HuntAction>; testMode: boolean };

const QR_SRC = `${import.meta.env.BASE_URL}qr.png`;

/**
 * Finale screen.
 *
 * The 3 hunt checkpoints unlock progressive QR slices but do NOT lead to the
 * actual EasyBox — the locker is its own destination, revealed here. Layout is
 * tuned to fit a phone viewport without scrolling: the QR sits small and taps
 * open to a fullscreen lightbox for scanning. Layout order:
 *
 *   1. Headline ("YOU ABSOLUTE LEGEND.") — pops in
 *   2. Locker hint card — name + hint + "open in maps" link
 *   3. Assembled QR card (compact) — crash-zooms in, tap to enlarge
 *   4. Instructions: "scan this when you get there"
 *   5. Celebrating mascot + finale sound + big confetti
 */
export default function Finale({ dispatch, testMode }: Props) {
  const { finale, easyboxLocation } = config;
  const [qrExpanded, setQrExpanded] = useState(false);

  useEffect(() => {
    // Sync sound + confetti with the QR scale-in peak (~1.5s after mount).
    const tSound = setTimeout(() => playFinale(), 1400);
    const tBurst = setTimeout(() => bigBurst(), 1500);
    return () => {
      clearTimeout(tSound);
      clearTimeout(tBurst);
    };
  }, []);

  return (
    <section className="screen screen--finale">
      <motion.div
        className="finale__top"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <motion.h1
          className="finale__headline"
          initial={{ scale: 0.4, opacity: 0, rotate: -6 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 16, delay: 0.1 }}
        >
          {finale.headline}
        </motion.h1>
        <p className="finale__subheadline">{finale.subheadline}</p>
      </motion.div>

      <motion.div
        className="locker-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <p className="eyebrow">{finale.lockerHintLabel}</p>
        <h2 className="locker-card__name">{easyboxLocation.name}</h2>
        <p className="locker-card__hint">{easyboxLocation.hint}</p>
        <a
          className="btn-ghost"
          href={easyboxLocation.mapsUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          {finale.openLockerMapLabel}
        </a>
      </motion.div>

      <motion.button
        type="button"
        className="qr-card"
        onClick={() => setQrExpanded(true)}
        aria-label="enlarge QR code"
        initial={{ scale: 0.15, rotate: -25, opacity: 0 }}
        animate={{
          scale: [0.15, 1.15, 0.95, 1.02, 1],
          rotate: [-25, 8, -3, 1, 0],
          opacity: 1,
        }}
        transition={{ duration: 1.2, ease: [0.34, 1.6, 0.64, 1], delay: 0.9 }}
      >
        <img src={QR_SRC} alt="EasyBox QR" draggable={false} />
        <motion.div
          className="qr-card__scanline"
          initial={{ y: '-100%' }}
          animate={{ y: '100%' }}
          transition={{ duration: 0.8, delay: 2.2, ease: 'linear' }}
          aria-hidden
        />
        <span className="qr-card__hint" aria-hidden>tap to enlarge</span>
      </motion.button>

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
          delay: 1.5,
          y: { duration: 0.5, repeat: Infinity, repeatType: 'mirror', delay: 2.2 },
        }}
        aria-hidden
      >
        <Mascot expression="celebrating" size={84} />
      </motion.div>

      <p className="finale__instruction">{finale.instruction}</p>

      {testMode && (
        <button className="dev-skip" onClick={() => dispatch({ type: 'RESET' })}>
          (dev) reset
        </button>
      )}

      <AnimatePresence>
        {qrExpanded && (
          <motion.div
            className="qr-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="EasyBox QR code"
            onClick={() => setQrExpanded(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.img
              className="qr-lightbox__img"
              src={QR_SRC}
              alt="EasyBox QR"
              draggable={false}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            />
            <p className="qr-lightbox__tip">{finale.qrBrightnessTip}</p>
            <span className="qr-lightbox__hint" aria-hidden>tap anywhere to close</span>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
