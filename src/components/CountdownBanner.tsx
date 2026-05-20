import { motion } from 'motion/react';
import { config } from '../config';
import { useCountdown } from '../lib/countdown';

/**
 * Countdown timer. Two looks:
 *   - default: sticky top banner overlaying the screen (chrome on most screens)
 *   - inline:  in-flow block (used on the intro in place of the path dots)
 *
 * Styling carries the urgency — coral mono digits on plum, drop shadow, a
 * slight idle wobble for the Michael Reeves vibe. No behavioral tiers.
 */
export default function CountdownBanner({
  deadlineISO,
  inline = false,
}: { deadlineISO?: string; inline?: boolean } = {}) {
  const target = deadlineISO ?? config.deadlineISO;
  const cd = useCountdown(target);

  return (
    <div
      className={inline ? 'countdown countdown--inline' : 'countdown'}
      role="timer"
      aria-live="off"
    >
      <p className="countdown__eyebrow">{config.countdown.eyebrow}</p>
      <motion.div
        className="countdown__digits tnum"
        animate={{ rotate: [-0.6, 0.6, -0.6] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        aria-label={`${cd.hh} hours ${cd.mm} minutes ${cd.ss} seconds remaining`}
      >
        <span>{cd.hh}</span>
        <span className="countdown__colon">:</span>
        <span>{cd.mm}</span>
        <span className="countdown__colon">:</span>
        <span>{cd.ss}</span>
      </motion.div>
    </div>
  );
}
