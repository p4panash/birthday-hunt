import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { config } from '../config';
import type { CheckpointIndex } from '../state/huntReducer';
import Mascot from './Mascot';

type Props = {
  open: boolean;
  n: CheckpointIndex;
  onClose: () => void;
  onCodeAccepted: () => void;
};

/**
 * Slide-up sheet revealed when the friend taps "stuck?".
 * Contains both the explicit hint (with maps deeplink) and the code-input
 * fallback. Wrong codes shake the input and flash the mascot's X_X eyes.
 */
export default function StuckSheet({ open, n, onClose, onCodeAccepted }: Props) {
  const cp = config.checkpoints[n];
  const [value, setValue] = useState('');
  const [shakeKey, setShakeKey] = useState(0);
  const [mascotState, setMascotState] = useState<'idle' | 'wrong-code'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset whenever the sheet opens or the checkpoint changes.
  useEffect(() => {
    if (open) {
      setValue('');
      setMascotState('idle');
      // Don't autofocus — keeps the keyboard from popping until he taps the field
    }
  }, [open, n]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const typed = value.trim().toUpperCase();
    const expected = cp.code.trim().toUpperCase();
    if (typed === expected) {
      onCodeAccepted();
    } else {
      setShakeKey((k) => k + 1);
      setMascotState('wrong-code');
      window.setTimeout(() => setMascotState('idle'), 700);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={config.stuckSheet.title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            <div className="sheet__handle" aria-hidden />
            <div className="sheet__mascot">
              <Mascot expression={mascotState} size={80} />
            </div>

            <p className="eyebrow">{config.stuckSheet.title}</p>
            <h2 className="sheet__title">{config.stuckSheet.realHintIntro}</h2>
            <p className="sheet__hint">{cp.realHint}</p>

            <a
              className="btn-ghost"
              href={cp.mapsUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              {config.stuckSheet.openInMapsCta}
            </a>

            <div className="sheet__divider" />

            <p className="sheet__code-label">{config.stuckSheet.codeLabel}</p>
            <form className="sheet__code-row" onSubmit={submit}>
              <motion.input
                ref={inputRef}
                key={shakeKey}
                className="code-input"
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={12}
                placeholder={config.stuckSheet.codePlaceholder}
                value={value}
                onChange={(e) => setValue(e.target.value.toUpperCase())}
                animate={
                  shakeKey > 0
                    ? { x: [-8, 8, -6, 6, -3, 3, 0] }
                    : { x: 0 }
                }
                transition={{ duration: 0.4 }}
              />
              <button type="submit" className="btn-primary btn-primary--small">
                {config.stuckSheet.unlockCta}
              </button>
            </form>
            {mascotState === 'wrong-code' && (
              <p className="sheet__error">{config.errors.wrongCode}</p>
            )}

            <button className="btn-ghost sheet__close" onClick={onClose}>
              {config.stuckSheet.closeCta}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
