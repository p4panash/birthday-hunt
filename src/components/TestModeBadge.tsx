import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { config } from '../config';
import {
  clearTestOverrides,
  setDeadlineOverride,
  setMockGeo,
} from '../lib/testOverrides';
import type { CheckpointIndex, HuntAction } from '../state/huntReducer';

type Props = {
  dispatch: React.Dispatch<HuntAction>;
  /** Current step for context-sensitive buttons. */
  currentN: CheckpointIndex | null;
};

/**
 * Test mode UI. Only renders when state.testMode is true. Bottom-right badge
 * expands to a debug drawer on tap.
 */
export default function TestModeBadge({ dispatch, currentN }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="test-badge"
        onClick={() => setOpen(true)}
        aria-label="open test mode drawer"
      >
        TEST
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="sheet-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.div
              className="sheet sheet--test"
              role="dialog"
              aria-modal="true"
              aria-label="test mode"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            >
              <div className="sheet__handle" aria-hidden />
              <h2 className="sheet__title">TEST MODE</h2>

              <Section title="jump to step">
                <Btn onClick={() => dispatch({ type: 'JUMP_TO_STEP', step: { kind: 'intro' } })}>intro</Btn>
                <Btn onClick={() => dispatch({ type: 'JUMP_TO_STEP', step: { kind: 'gps-preface' } })}>gps preface</Btn>
                <Btn onClick={() => dispatch({ type: 'JUMP_TO_STEP', step: { kind: 'location', n: 0 } })}>location 1</Btn>
                <Btn onClick={() => dispatch({ type: 'JUMP_TO_STEP', step: { kind: 'location', n: 1 } })}>location 2</Btn>
                <Btn onClick={() => dispatch({ type: 'JUMP_TO_STEP', step: { kind: 'location', n: 2 } })}>location 3</Btn>
                <Btn onClick={() => dispatch({ type: 'JUMP_TO_STEP', step: { kind: 'finale' } })}>finale</Btn>
              </Section>

              <Section title="simulate gps">
                <Btn
                  onClick={() => {
                    if (currentN == null) return;
                    const cp = config.checkpoints[currentN];
                    setMockGeo({ lat: cp.lat, lng: cp.lng, accuracy: 5 });
                  }}
                  disabled={currentN == null}
                >
                  at current location
                </Btn>
                <Btn onClick={() => setMockGeo({ lat: 0, lng: 0, accuracy: 5 })}>
                  far away
                </Btn>
                <Btn onClick={() => setMockGeo(null)}>clear mock</Btn>
              </Section>

              <Section title="checkpoint">
                <Btn
                  onClick={() => {
                    if (currentN != null) dispatch({ type: 'UNLOCK_CHECKPOINT', n: currentN });
                  }}
                  disabled={currentN == null}
                >
                  trigger reveal now
                </Btn>
              </Section>

              <Section title="deadline">
                <Btn
                  onClick={() => {
                    const dl = new Date(Date.now() + 30_000).toISOString();
                    setDeadlineOverride(dl);
                  }}
                >
                  set now + 30s
                </Btn>
                <Btn onClick={() => setDeadlineOverride(null)}>clear override</Btn>
              </Section>

              <Section title="danger zone">
                <Btn
                  onClick={() => {
                    clearTestOverrides();
                    dispatch({ type: 'RESET' });
                    setOpen(false);
                  }}
                >
                  reset progress
                </Btn>
              </Section>

              <button className="btn-ghost sheet__close" onClick={() => setOpen(false)}>
                close
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="test-section">
      <p className="test-section__title">{title}</p>
      <div className="test-section__grid">{children}</div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button className="test-btn" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
