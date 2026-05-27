import Icon from '../../Icon';
import type { HuntDraft } from '../data';
import { OCCASIONS, STEPS } from '../data';
import { AiNudge, Field, StepPage } from '../primitives';

interface Props {
  draft: HuntDraft;
  set: <K extends keyof HuntDraft>(k: K, v: HuntDraft[K]) => void;
}

export default function BasicsStep({ draft, set }: Props) {
  return (
    <StepPage
      step={STEPS[0]}
      maxWidth={1040}
      intro="A few quick facts about the hunt. We'll use these to season the suggestions later."
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        <Field label="Hunt name" hint="A nickname for this hunt. Visible to your hunters.">
          <input
            className="input"
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. lma m1halcea"
          />
        </Field>
        <Field label="Who is it for?" hint="The person discovering the hunt.">
          <input
            className="input"
            value={draft.recipient}
            onChange={(e) => set('recipient', e.target.value)}
          />
        </Field>
        <Field label="When" hint="Date they'll play. We'll lock the start time later.">
          <div style={{ position: 'relative' }}>
            <input
              className="input"
              type="date"
              value={draft.date}
              onChange={(e) => set('date', e.target.value)}
              style={{ paddingLeft: 38 }}
            />
            <Icon
              name="calendar"
              size={16}
              color="var(--muted)"
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
              }}
            />
          </div>
        </Field>
        <Field label="Time window" hint="When the hunt is playable.">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              value={draft.timeStart}
              onChange={(e) => set('timeStart', e.target.value)}
            />
            <span style={{ alignSelf: 'center', color: 'var(--muted)' }}>→</span>
            <input
              className="input"
              value={draft.timeEnd}
              onChange={(e) => set('timeEnd', e.target.value)}
            />
          </div>
        </Field>
      </div>

      <div style={{ marginTop: 30 }}>
        <Field label="Occasion" hint="So we can pick suggestions that match the energy.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {OCCASIONS.map((o) => {
              const on = draft.occasion === o.id;
              return (
                <button
                  key={o.id}
                  className="btn"
                  onClick={() => set('occasion', o.id)}
                  style={{
                    padding: '14px 12px',
                    flexDirection: 'column',
                    gap: 8,
                    alignItems: 'flex-start',
                    background: on ? 'var(--terra-soft)' : 'var(--paper)',
                    border: '1px solid ' + (on ? 'var(--terra)' : 'var(--line)'),
                    color: 'var(--ink)',
                    fontWeight: 400,
                    cursor: 'pointer',
                  }}
                >
                  <Icon name={o.icon} size={18} color={on ? 'var(--terra)' : 'var(--ink-2)'} />
                  <span style={{ fontSize: 13 }}>{o.label}</span>
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      <AiNudge>
        I noticed you used{' '}
        <span className="serif-italic">&ldquo;{draft.title}&rdquo;</span> — looks like a{' '}
        {draft.occasion} for {draft.recipient}. I'll lean into in-jokes and personal
        references for the clues.
      </AiNudge>
    </StepPage>
  );
}
