import Icon from '../../Icon';
import { STEPS, THEMES, type HuntDraft } from '../data';
import { AiNudge, StepPage, useStaggered } from '../primitives';

interface Props {
  draft: HuntDraft;
  set: <K extends keyof HuntDraft>(k: K, v: HuntDraft[K]) => void;
}

export default function ThemeStep({ draft, set }: Props) {
  const visible = useStaggered(THEMES.length, 50);
  return (
    <StepPage
      step={STEPS[2]}
      wide
      intro="Themes thread the stops together. Pick one — we tailor stop suggestions and clue tone. Or start blank."
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 14,
          maxWidth: 1080,
          margin: '0 auto',
        }}
      >
        {THEMES.map((t, i) => {
          const on = draft.theme === t.id;
          const show = i < visible;
          return (
            <div
              key={t.id}
              className="card"
              style={{
                padding: 0,
                overflow: 'hidden',
                cursor: 'pointer',
                borderColor: on ? 'var(--terra)' : 'var(--line)',
                boxShadow: on ? 'var(--shadow-2)' : 'none',
                transition: 'opacity 220ms, transform 220ms, border-color 120ms',
                opacity: show ? 1 : 0,
                transform: show ? 'translateY(0)' : 'translateY(8px)',
              }}
              onClick={() => set('theme', t.id)}
            >
              <div
                style={{
                  height: 110,
                  background: `linear-gradient(135deg, ${t.palette[0]} 0%, ${t.palette[1]} 100%)`,
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'repeating-linear-gradient(45deg, rgba(255,255,255,0) 0 8px, rgba(255,255,255,.04) 8px 16px)',
                  }}
                />
                {on && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--terra)',
                    }}
                  >
                    <Icon name="check" size={14} stroke={2.4} />
                  </div>
                )}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 10,
                    left: 14,
                    color: 'white',
                    opacity: 0.9,
                  }}
                  className="mono"
                >
                  <span style={{ fontSize: 10, letterSpacing: '0.1em' }}>
                    {t.tag.toUpperCase()}
                  </span>
                </div>
              </div>
              <div style={{ padding: '14px 16px 16px' }}>
                <div className="serif" style={{ fontSize: 22, lineHeight: 1.05 }}>
                  {t.title}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--muted)',
                    marginTop: 6,
                    lineHeight: 1.5,
                  }}
                >
                  {t.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <AiNudge>
        &ldquo;A book of firsts&rdquo; pairs well with a birthday — I'll prefer stops that
        have personal-memory hooks (cafés, bookshops, that bench by the river).
      </AiNudge>
    </StepPage>
  );
}
