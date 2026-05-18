import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { config, photoAfter } from '../config';
import { smallBurst } from '../lib/confettiBurst';
import { playUnlock } from '../lib/sounds';
import Mascot from '../components/Mascot';
import type { CheckpointIndex, HuntAction } from '../state/huntReducer';

type Props = {
  dispatch: React.Dispatch<HuntAction>;
  n: CheckpointIndex;
  slice: string | null;
};

/**
 * The reveal animation, per master plan §2.4:
 *   ① mascot waddles in from off-screen
 *   ② mascot "spits" — slice appears at its mouth, yeets toward center
 *   ③ slice does derpy rotate + overshoot + squish bounce
 *   ④ confetti burst (X-shapes)
 *   ⑤ continue CTA appears
 *
 * The slice does NOT FLIP into the scaffold cell here — we keep the cell empty
 * during reveal (App.tsx passes `revealingN={n}` to ProgressScaffold), and the
 * cell fills with a spring pop on `REVEAL_COMPLETE`. Simpler than layoutId
 * orchestration across screen unmount, equally derpy.
 */
export default function Reveal({ dispatch, n, slice }: Props) {
  const cp = config.checkpoints[n];
  const hasPhotoAfter = photoAfter(n) !== null;
  const [phase, setPhase] = useState<'waddle' | 'spit' | 'hold' | 'done'>('waddle');

  useEffect(() => {
    const t1 = setTimeout(() => {
      setPhase('spit');
      playUnlock();
    }, 700);
    const t2 = setTimeout(() => setPhase('hold'), 1500);
    const t3 = setTimeout(() => {
      setPhase('done');
      smallBurst({ x: 0.5, y: 0.45 });
    }, 2300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [n]);

  return (
    <section className="screen screen--reveal">
      <p className="eyebrow">{n + 1} / 3</p>
      <motion.h1
        className="reveal__headline"
        initial={{ scale: 0.4, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{
          type: 'spring',
          stiffness: 380,
          damping: 14,
          delay: 0.15,
        }}
      >
        {config.reveal.headline}
      </motion.h1>

      <div className="reveal__stage" aria-hidden>
        {/* Mascot waddles in from the left */}
        <motion.div
          className="reveal__mascot"
          initial={{ x: '-120%', rotate: -10 }}
          animate={{
            x: phase === 'waddle' ? '-30%' : '-10%',
            rotate: [0, -8, 6, -4, 0],
          }}
          transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <Mascot
            expression={phase === 'done' ? 'celebrating' : 'excited'}
            size={140}
          />
        </motion.div>

        {/* Slice — appears at mascot mouth, then yeets into center, then derpy idle */}
        {slice && phase !== 'waddle' && (
          <motion.img
            className="reveal__slice"
            src={slice}
            alt=""
            initial={{ x: '-20%', y: '20%', scale: 0.25, rotate: -90, opacity: 0 }}
            animate={
              phase === 'spit'
                ? { x: '0%', y: '0%', scale: 1.15, rotate: 540, opacity: 1 }
                : { x: '0%', y: '0%', scale: [1.15, 0.85, 1.05, 1.0], rotate: [540, 555, 545, 540] }
            }
            transition={
              phase === 'spit'
                ? { duration: 0.9, ease: [0.34, 1.8, 0.64, 1] }
                : { duration: 0.5, ease: 'easeInOut' }
            }
            draggable={false}
          />
        )}
      </div>

      <p className="reveal__success">{cp.successCopy}</p>

      <motion.button
        className="btn-primary"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: phase === 'done' ? 0 : 40, opacity: phase === 'done' ? 1 : 0 }}
        transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        disabled={phase !== 'done'}
        onClick={() =>
          dispatch({ type: 'REVEAL_COMPLETE', n, hasPhotoAfter })
        }
      >
        {n < 2 ? config.reveal.nextCta : config.reveal.finaleCta}
      </motion.button>
    </section>
  );
}
