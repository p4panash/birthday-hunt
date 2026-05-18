import { motion } from 'motion/react';
import type { CheckpointIndex } from '../state/huntReducer';

type Props = {
  /** Slice display URLs (null until QR loads). */
  sliceUrls: [string, string, string] | null;
  /** Which cells should already show their slice. */
  unlocked: [boolean, boolean, boolean];
  /** The cell that's "active" (current step). */
  currentN: CheckpointIndex | null;
  /** While reveal animation plays for this index, keep its cell visually empty
   * so the centered slice in the Reveal screen is the only one on screen. */
  revealingN: CheckpointIndex | null;
};

/**
 * Persistent 3-cell progress bar. Doubles as the QR puzzle that fills in
 * as the friend completes checkpoints. Lives in App.tsx, visible on
 * location / reveal / photo / finale screens (not on intro / gps-preface).
 */
export default function ProgressScaffold({
  sliceUrls,
  unlocked,
  currentN,
  revealingN,
}: Props) {
  return (
    <div className="scaffold" role="progressbar" aria-label="hunt progress">
      {[0, 1, 2].map((idx) => {
        const n = idx as CheckpointIndex;
        const isCompleted = unlocked[n] && revealingN !== n;
        const isActive = !isCompleted && currentN === n;
        const slice = sliceUrls?.[n];

        return (
          <motion.div
            key={n}
            className={[
              'scaffold__cell',
              isCompleted && 'scaffold__cell--done',
              isActive && 'scaffold__cell--active',
            ]
              .filter(Boolean)
              .join(' ')}
            animate={
              isActive
                ? { scale: [1, 1.06, 1] }
                : { scale: 1 }
            }
            transition={
              isActive
                ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.25 }
            }
          >
            {isCompleted && slice ? (
              <motion.img
                key="slice"
                src={slice}
                alt=""
                initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 320,
                  damping: 18,
                }}
                draggable={false}
              />
            ) : (
              <span className="scaffold__num">{n + 1}</span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
