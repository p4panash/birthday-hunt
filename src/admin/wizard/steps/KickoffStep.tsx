// Kickoff — single-prompt entry. User writes one paragraph; the Worker calls
// Claude with a structured schema; we stream the lines back as they arrive.
//
// Falls back to a canned local draft if the Worker is unreachable so the
// designer-facing demo still works without a key.

import { useEffect, useRef, useState } from 'react';
import Icon from '../../Icon';
import { KICKOFF_PROMPTS, type HuntDraft } from '../data';
import { MapCanvas } from '../MapCanvas';

interface Props {
  draft: HuntDraft;
  onDraft: (next: HuntDraft) => void;
  onSkip: () => void;
}

interface DraftLine {
  id: 'occasion' | 'city' | 'theme' | 'shape' | 'stops' | 'reward';
  label: string;
  value: string;
}

const LOCAL_FALLBACK: DraftLine[] = [
  { id: 'occasion', label: 'Occasion',        value: 'Birthday · Mihaela · 14 Jun 2026' },
  { id: 'city',     label: 'City',            value: 'Cluj-Napoca · Centru istoric (1.8 km loop)' },
  { id: 'theme',    label: 'Theme',           value: 'A book of firsts — romantic, 5 stops' },
  { id: 'shape',    label: 'Pace',            value: 'Sweet difficulty · ~1h 30m · 5,400 steps' },
  { id: 'stops',    label: 'Suggested stops', value: 'Klausenburg → Cărturești → Parcul Central → Insomnia → Cetățuia' },
  { id: 'reward',   label: 'Finale',          value: 'Locker on Cetățuia · code 07-23-14 · warm hand-written note' },
];

export default function KickoffStep({ draft, onDraft, onSkip }: Props) {
  const [prompt, setPrompt] = useState('');
  const [phase, setPhase] = useState<'idle' | 'thinking' | 'done' | 'error'>('idle');
  const [lines, setLines] = useState<DraftLine[]>(LOCAL_FALLBACK);
  const [revealed, setRevealed] = useState<DraftLine['id'][]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draftPatch, setDraftPatch] = useState<Partial<HuntDraft> | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    taRef.current?.focus();
  }, []);

  const generate = async () => {
    if (!prompt.trim() || phase === 'thinking') return;
    setPhase('thinking');
    setRevealed([]);
    setError(null);
    setDraftPatch(null);

    try {
      const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
      const res = await fetch(`${apiBase}/api/admin/wizard/draft`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      if (!res.ok) {
        throw new Error(`draft failed: ${res.status}`);
      }
      const data = (await res.json()) as { lines: DraftLine[]; patch: Partial<HuntDraft> };
      const incoming = Array.isArray(data.lines) && data.lines.length === 6 ? data.lines : LOCAL_FALLBACK;
      setLines(incoming);
      setDraftPatch(data.patch ?? null);
      // Stream the reveal client-side for the feel even though the AI
      // response arrives all at once.
      incoming.forEach((l, i) => {
        setTimeout(() => setRevealed((r) => [...r, l.id]), 320 + i * 360);
      });
      setTimeout(() => setPhase('done'), 320 + incoming.length * 360 + 100);
    } catch (e) {
      // Soft-fall back to the canned draft so the screen still moves. The
      // user can hit "Try another prompt" to retry.
      setLines(LOCAL_FALLBACK);
      LOCAL_FALLBACK.forEach((l, i) => {
        setTimeout(() => setRevealed((r) => [...r, l.id]), 320 + i * 360);
      });
      setTimeout(() => {
        setPhase('done');
        setError((e as Error).message + ' (using local sample)');
      }, 320 + LOCAL_FALLBACK.length * 360 + 100);
    }
  };

  const tryAnother = () => {
    setPhase('idle');
    setRevealed([]);
    setError(null);
    setDraftPatch(null);
  };

  const applyDraft = () => {
    if (draftPatch) {
      onDraft({ ...draft, ...draftPatch });
    } else {
      onDraft(draft);
    }
  };

  return (
    <div
      className="ab"
      style={{
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: 'var(--bg)',
        height: '100%',
      }}
    >
      {/* faint cartographic background */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.35,
          pointerEvents: 'none',
        }}
      >
        <MapCanvas tone="light" showLabels={false} density={0.5} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 50% 40%, transparent 0%, var(--bg) 70%)',
          }}
        />
      </div>

      {/* top bar */}
      <header
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '20px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ flex: 1 }} />
        <button className="btn btn-quiet" onClick={onSkip} style={{ fontSize: 12 }}>
          Skip — set up manually <Icon name="arrow-r" size={13} />
        </button>
      </header>

      {/* center stack */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 28px 60px',
          overflowY: 'auto',
        }}
      >
        <div style={{ width: '100%', maxWidth: 720 }}>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--muted)',
              letterSpacing: '0.16em',
              textAlign: 'center',
            }}
          >
            START A NEW HUNT
          </div>
          <h1
            className="serif"
            style={{
              fontSize: 64,
              lineHeight: 1,
              textAlign: 'center',
              margin: '14px 0 6px',
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            Tell me about the hunt
          </h1>
          <p
            style={{
              textAlign: 'center',
              fontSize: 17,
              color: 'var(--muted)',
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              margin: 0,
            }}
          >
            One paragraph. I'll draft a route, theme, clues, and a finale for you to refine.
          </p>

          {/* prompt box */}
          <div
            style={{
              marginTop: 28,
              position: 'relative',
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: 16,
              boxShadow: 'var(--shadow-2)',
              transition: 'box-shadow 200ms, border-color 200ms',
            }}
          >
            <textarea
              ref={taRef}
              className="textarea"
              rows={4}
              placeholder="A birthday hunt for my girlfriend in Cluj. 5 stops in Centru, warm and romantic, ending at a locker on Cetățuia with her gift."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  generate();
                }
              }}
              disabled={phase === 'thinking'}
              style={{
                border: 'none',
                background: 'transparent',
                fontFamily: 'var(--serif)',
                fontSize: 21,
                lineHeight: 1.45,
                padding: '20px 22px 14px',
                color: 'var(--ink)',
                boxShadow: 'none',
              }}
            />
            <div
              style={{
                padding: '10px 14px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                borderTop: '1px solid var(--line)',
              }}
            >
              <span
                className="mono"
                style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em' }}
              >
                <Icon
                  name="spark"
                  size={11}
                  color="var(--terra)"
                  style={{ display: 'inline-block', verticalAlign: -2, marginRight: 4 }}
                />
                CLAUDE DRAFTS 8 STEPS · YOU EDIT EVERY ONE
              </span>
              <span style={{ flex: 1 }} />
              <span className="kbd">⏎ to generate</span>
              <button
                className="btn btn-terra"
                onClick={generate}
                disabled={!prompt.trim() || phase === 'thinking'}
                style={{ opacity: !prompt.trim() ? 0.5 : 1 }}
              >
                {phase === 'thinking' ? (
                  <>
                    Drafting…{' '}
                    <span
                      className="dot"
                      style={{ background: 'white', opacity: 0.6 }}
                    />
                  </>
                ) : (
                  <>
                    Draft my hunt <Icon name="arrow-r" size={14} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* example prompts */}
          {phase === 'idle' && (
            <div style={{ marginTop: 22 }}>
              <div
                className="label"
                style={{ marginBottom: 10, textAlign: 'center' }}
              >
                Or try a starter
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                }}
              >
                {KICKOFF_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setPrompt(p);
                      taRef.current?.focus();
                    }}
                    className="card"
                    style={{
                      padding: '12px 14px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      background: 'var(--paper)',
                      border: '1px solid var(--line)',
                      fontFamily: 'var(--serif)',
                      fontSize: 14.5,
                      lineHeight: 1.5,
                      color: 'var(--ink-2)',
                      fontStyle: 'italic',
                    }}
                  >
                    <Icon
                      name={(['cake', 'crown', 'briefcase', 'heart'] as const)[i]}
                      size={14}
                      color="var(--terra)"
                      style={{
                        display: 'inline-block',
                        verticalAlign: -2,
                        marginRight: 8,
                      }}
                    />
                    {p.length > 90 ? p.slice(0, 90) + '…' : p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* draft preview that streams in */}
          {phase !== 'idle' && (
            <div
              style={{
                marginTop: 28,
                background: 'var(--paper)',
                border: '1px solid var(--line)',
                borderRadius: 16,
                padding: '20px 24px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'var(--ink)',
                    color: 'var(--bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="spark" size={14} />
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.12em',
                    color: 'var(--muted)',
                  }}
                >
                  CLAUDE · DRAFT
                </div>
                <span style={{ flex: 1 }} />
                {phase === 'done' && (
                  <span className="chip chip-moss">
                    <Icon name="check" size={11} stroke={2.4} /> Ready to refine
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {lines.map((l) => {
                  const shown = revealed.includes(l.id);
                  return (
                    <div
                      key={l.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '120px 1fr',
                        gap: 16,
                        alignItems: 'baseline',
                        opacity: shown ? 1 : 0.25,
                        transform: shown ? 'translateY(0)' : 'translateY(4px)',
                        transition: 'opacity 320ms, transform 320ms',
                      }}
                    >
                      <div className="label">{l.label}</div>
                      <div
                        className="serif"
                        style={{
                          fontSize: 18,
                          lineHeight: 1.35,
                          color: 'var(--ink)',
                          position: 'relative',
                        }}
                      >
                        {shown ? (
                          l.value
                        ) : (
                          <span
                            style={{
                              display: 'inline-block',
                              width: '70%',
                              height: 16,
                              background: 'var(--bg-2)',
                              borderRadius: 4,
                            }}
                            className="shimmer"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {error && (
                <div
                  style={{
                    marginTop: 14,
                    fontSize: 12,
                    color: 'var(--terra)',
                    fontFamily: 'var(--mono)',
                  }}
                >
                  {error}
                </div>
              )}
              {phase === 'done' && (
                <div
                  style={{
                    marginTop: 20,
                    paddingTop: 18,
                    borderTop: '1px solid var(--line)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <button
                    className="btn btn-quiet"
                    onClick={tryAnother}
                    style={{ fontSize: 13 }}
                  >
                    <Icon name="undo" size={13} /> Try another prompt
                  </button>
                  <span style={{ flex: 1 }} />
                  <button
                    className="btn btn-ghost"
                    onClick={onSkip}
                    style={{ fontSize: 13 }}
                  >
                    Open all 8 steps
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={applyDraft}
                    style={{ fontSize: 13 }}
                  >
                    Refine step by step <Icon name="arrow-r" size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* footer */}
      <footer
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '16px 28px',
          borderTop: '1px solid var(--line)',
          background: 'var(--paper)',
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          fontSize: 12,
          color: 'var(--muted)',
        }}
      >
        <span>v1 · saved locally</span>
        <span style={{ flex: 1 }} />
        <span>
          Have a draft?{' '}
          <a
            style={{
              color: 'var(--terra)',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            Load it
          </a>
        </span>
      </footer>
    </div>
  );
}
