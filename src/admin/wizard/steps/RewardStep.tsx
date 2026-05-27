import Icon from '../../Icon';
import { STEPS, type HuntDraft } from '../data';
import { AiNudge, Field, StepPage } from '../primitives';

interface Props {
  draft: HuntDraft;
  setDraft: React.Dispatch<React.SetStateAction<HuntDraft>>;
}

const KINDS = [
  { id: 'locker',   label: 'Locker code',     icon: 'lock',  desc: 'A real locker, a real key. Code unlocks at the final stop.' },
  { id: 'envelope', label: 'Sealed envelope', icon: 'gift',  desc: 'Hidden envelope at the final location.' },
  { id: 'person',   label: 'A person',        icon: 'users', desc: 'Someone is waiting at the final stop.' },
  { id: 'digital',  label: 'Digital reveal',  icon: 'qr',    desc: 'Phone reveals a video, photo album, or message.' },
] as const;

export default function RewardStep({ draft, setDraft }: Props) {
  const setReward = (patch: Partial<HuntDraft['reward']>) =>
    setDraft((d) => ({ ...d, reward: { ...d.reward, ...patch } }));

  return (
    <StepPage
      step={STEPS[6]}
      intro="Every hunt earns a finale. Tell us where the prize lives — we'll bake the unlock into the final stop."
    >
      <Field label="Reward type">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {KINDS.map((k) => {
            const on = draft.reward.kind === k.id;
            return (
              <div
                key={k.id}
                className="card"
                style={{
                  padding: 14,
                  cursor: 'pointer',
                  background: on ? 'var(--terra-soft)' : 'var(--paper)',
                  borderColor: on ? 'var(--terra)' : 'var(--line)',
                }}
                onClick={() => setReward({ kind: k.id })}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon name={k.icon} size={18} color={on ? 'var(--terra)' : 'var(--ink-2)'} />
                  <div className="serif" style={{ fontSize: 19 }}>
                    {k.label}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--muted)',
                    marginTop: 6,
                    lineHeight: 1.5,
                  }}
                >
                  {k.desc}
                </div>
              </div>
            );
          })}
        </div>
      </Field>

      {draft.reward.kind === 'locker' && (
        <div
          style={{
            marginTop: 28,
            display: 'grid',
            gridTemplateColumns: '180px 1fr',
            gap: 24,
            alignItems: 'start',
          }}
        >
          <Field label="Locker code" hint="3 numbers, separated.">
            <input
              className="input"
              value={draft.reward.code}
              onChange={(e) => setReward({ code: e.target.value })}
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 22,
                textAlign: 'center',
                letterSpacing: '0.1em',
                padding: '16px 12px',
              }}
            />
          </Field>
          <Field label="Message inside" hint="What they read when they unlock it.">
            <textarea
              className="textarea"
              rows={4}
              value={draft.reward.message}
              onChange={(e) => setReward({ message: e.target.value })}
              style={{ fontFamily: 'var(--serif)', fontSize: 18, lineHeight: 1.45 }}
            />
          </Field>
        </div>
      )}

      <div
        style={{
          marginTop: 32,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: 16,
          background: 'var(--bg-2)',
          borderRadius: 12,
          border: '1px solid var(--line)',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 10,
            background: 'var(--ink)',
            color: 'var(--bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="gift" size={26} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="serif" style={{ fontSize: 22, lineHeight: 1 }}>
            Final reveal at{' '}
            <span className="serif-italic">
              {draft.stops[draft.stops.length - 1]?.name ?? 'the last stop'}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
            Locker key under the seat, unlocks with{' '}
            <span className="mono" style={{ color: 'var(--ink)' }}>
              {draft.reward.code}
            </span>
            .
          </div>
        </div>
        <button className="btn btn-ghost" style={{ fontSize: 12 }}>
          <Icon name="eye" size={13} /> Preview reveal
        </button>
      </div>

      <AiNudge>
        Birthdays go warm — drafted the message warmer than usual. You can dial it down
        with &ldquo;Make easier&rdquo; on a clue if it feels too much.
      </AiNudge>
    </StepPage>
  );
}
