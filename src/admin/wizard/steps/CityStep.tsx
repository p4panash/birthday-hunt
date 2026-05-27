import Icon from '../../Icon';
import { CITIES, STEPS, type CityId, type HuntDraft } from '../data';
import { MapCanvas } from '../MapCanvas';
import { AiNudge, Field, StepPage } from '../primitives';

interface Props {
  draft: HuntDraft;
  set: <K extends keyof HuntDraft>(k: K, v: HuntDraft[K]) => void;
}

export default function CityStep({ draft, set }: Props) {
  const areas = ['Centru istoric', 'Piața Unirii', 'Mănăștur', 'Gheorgheni', 'Mărăști', 'Iris'];
  return (
    <StepPage
      step={STEPS[1]}
      intro="Pick a city. We'll narrow stop suggestions to a walkable district inside it on the next step."
    >
      <div style={{ position: 'relative', marginBottom: 22 }}>
        <Icon
          name="search"
          size={16}
          color="var(--muted)"
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        />
        <input
          className="input"
          placeholder="Search a city, neighbourhood, or address"
          style={{ paddingLeft: 38, fontSize: 14 }}
        />
      </div>
      <div className="label" style={{ marginBottom: 10 }}>Popular</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {CITIES.map((c) => {
          const on = draft.city === c.id;
          return (
            <div
              key={c.id}
              className="card"
              style={{
                padding: 16,
                cursor: 'pointer',
                borderColor: on ? 'var(--terra)' : 'var(--line)',
                background: on ? 'var(--terra-soft)' : 'var(--paper)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
              onClick={() => set('city', c.id as CityId)}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 8,
                  background: 'var(--bg-2)',
                  border: '1px solid var(--line)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <MapCanvas tone="light" showLabels={false} density={0.3} />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="pin" size={18} color="var(--terra)" />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className="serif" style={{ fontSize: 22, lineHeight: 1 }}>
                  {c.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  {c.meta}
                </div>
              </div>
              <span className="chip chip-mono">{c.tag}</span>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 28 }}>
        <Field label="Area within the city" hint="We'll bias suggestions to this area.">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {areas.map((a) => {
              const on = draft.area === a;
              return (
                <button
                  key={a}
                  className="chip"
                  onClick={() => set('area', a)}
                  style={{
                    cursor: 'pointer',
                    background: on ? 'var(--ink)' : 'var(--paper)',
                    color: on ? 'var(--bg)' : 'var(--ink)',
                    borderColor: on ? 'var(--ink)' : 'var(--line)',
                    padding: '7px 12px',
                    fontSize: 12.5,
                  }}
                >
                  {a}
                  {on ? ' ✓' : ''}
                </button>
              );
            })}
            <button className="chip">
              <Icon name="plus" size={11} /> Custom area on map
            </button>
          </div>
        </Field>
      </div>

      <AiNudge>
        Bounded radius 800m. 4–6 stops fit a tight walkable loop without burning out the
        hunters.
      </AiNudge>
    </StepPage>
  );
}
