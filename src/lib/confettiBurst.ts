import confetti from 'canvas-confetti';

const REDUCED_MOTION =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const COLORS = ['#FF6B5B', '#FFD89C', '#F5EBD9', '#FFB347'];

/**
 * Cheerful "X"-shaped confetti burst, tuned for the reveal moment.
 * Respects prefers-reduced-motion — silent no-op.
 */
export function smallBurst(origin: { x: number; y: number } = { x: 0.5, y: 0.45 }) {
  if (REDUCED_MOTION) return;
  const xShape = confetti.shapeFromText({ text: '×', scalar: 2 });
  const shapes: confetti.Shape[] = [xShape, 'square'];
  confetti({
    particleCount: 40,
    spread: 70,
    startVelocity: 35,
    gravity: 1,
    ticks: 120,
    origin,
    colors: COLORS,
    shapes,
    scalar: 1.1,
  });
}

/** Full-screen finale burst — louder, longer, more particles. */
export function bigBurst() {
  if (REDUCED_MOTION) return;
  const xShape = confetti.shapeFromText({ text: '×', scalar: 2.6 });
  const shapes: confetti.Shape[] = [xShape, 'square'];
  const defaults: confetti.Options = {
    spread: 100,
    startVelocity: 55,
    ticks: 220,
    colors: COLORS,
    shapes,
    scalar: 1.4,
  };
  confetti({ ...defaults, particleCount: 80, origin: { x: 0.2, y: 0.6 } });
  confetti({ ...defaults, particleCount: 80, origin: { x: 0.8, y: 0.6 } });
  setTimeout(() => {
    confetti({ ...defaults, particleCount: 60, origin: { x: 0.5, y: 0.4 } });
  }, 250);
}
