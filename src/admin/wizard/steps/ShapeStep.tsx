import Icon from '../../Icon';
import { STEPS, type HuntDraft } from '../data';
import { AiNudge, Field, StepPage } from '../primitives';

interface Props {
  draft: HuntDraft;
  set: <K extends keyof HuntDraft>(k: K, v: HuntDraft[K]) => void;
}

const DIFFICULTIES = [
  { id: 'sweet',   label: 'Sweet',   desc: 'Clear hints, generous nudges. Low frustration.',    time: '~1h 20m', icon: 'sun' },
  { id: 'classic', label: 'Classic', desc: 'Riddles that take a beat. Hints available on tap.', time: '~2h',     icon: 'compass' },
  { id: 'cruel',   label: 'Cruel',   desc: 'Wordplay, doubles back, photo proofs required.',    time: '~3h',     icon: 'moon' },
] as const;

export default function ShapeStep({ draft, set }: Props) {
  return (
    <StepPage
      step={STEPS[3]}
      intro="How long, how hard? You can change this per-stop later."
    >
      <Field label="Number of stops">
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <button
            className="btn btn-ghost"
            style={{ width: 38, height: 38, padding: 0, justifyContent: 'center' }}
            onClick={() => set('stopCount', Math.max(3, draft.stopCount - 1))}
          >
            <Icon name="minus" size={14} />
          </button>
          <div
            className="serif"
            style={{
              fontSize: 56,
              lineHeight: 1,
              color: 'var(--ink)',
              minWidth: 80,
              textAlign: 'center',
            }}
          >
            {draft.stopCount}
          </div>
          <button
            className="btn btn-ghost"
            style={{ width: 38, height: 38, padding: 0, justifyContent: 'center' }}
            onClick={() => set('stopCount', Math.min(12, draft.stopCount + 1))}
          >
            <Icon name="plus" size={14} />
          </button>
          <div
            style={{
              marginLeft: 16,
              fontSize: 13,
              color: 'var(--muted)',
              fontStyle: 'italic',
              fontFamily: 'var(--serif)',
            }}
          >
            sweet spot is 4–6 for one afternoon
          </div>
        </div>
      </Field>

      <div style={{ marginTop: 32 }}>
        <Field label="Difficulty">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {DIFFICULTIES.map((d) => {
              const on = draft.difficulty === d.id;
              return (
                <div
                  key={d.id}
                  className="card"
                  style={{
                    padding: 16,
                    cursor: 'pointer',
                    borderColor: on ? 'var(--terra)' : 'var(--line)',
                    background: on ? 'var(--terra-soft)' : 'var(--paper)',
                  }}
                  onClick={() => set('difficulty', d.id)}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <Icon name={d.icon} size={18} color={on ? 'var(--terra)' : 'var(--ink-2)'} />
                    <div className="serif" style={{ fontSize: 22, lineHeight: 1 }}>
                      {d.label}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--muted)',
                      lineHeight: 1.5,
                      minHeight: 56,
                    }}
                  >
                    {d.desc}
                  </div>
                  <div
                    className="mono"
                    style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 8 }}
                  >
                    {d.time}
                  </div>
                </div>
              );
            })}
          </div>
        </Field>
      </div>

      <div
        style={{
          marginTop: 32,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 18,
        }}
      >
        <Field label="Clue format mix" hint="What kinds of clues the AI should draft.">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['Riddles', 'Photos', 'Codes', 'NPC asks', 'Trivia'].map((t, i) => (
              <span key={t} className={'chip ' + (i < 3 ? 'chip-terra' : '')}>
                {t}
              </span>
            ))}
            <button className="chip">
              <Icon name="plus" size={11} />
            </button>
          </div>
        </Field>
        <Field label="Estimated runtime" hint="From the difficulty and stop count.">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="serif" style={{ fontSize: 36 }}>
              1h 30m
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              · 1.8 km walk · ~5,400 steps
            </span>
          </div>
        </Field>
      </div>

      <AiNudge>
        {draft.stopCount} stops at &ldquo;{draft.difficulty}&rdquo; difficulty over an
        afternoon — comfortable. I'll save the trickier wordplay for stops in the middle
        when they're warmed up.
      </AiNudge>
    </StepPage>
  );
}
