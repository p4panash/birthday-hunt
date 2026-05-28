// QuestWizard — the top-level admin route at /admin/wizard.
//
// Holds the draft state, routes between the kickoff and the nine steps,
// and on publish maps the draft into a HuntConfig and POSTs through the
// existing admin createHunt API.

import { useState } from 'react';
import Icon from '../Icon';
import { createHunt } from '../adminApi';
import {
  defaultDraft,
  STEPS,
  type HuntDraft,
  type SuggestedStop,
} from './data';
import { draftToHuntConfig, type CreateHuntResult } from './submit';
import BasicsStep from './steps/BasicsStep';
import CityStep from './steps/CityStep';
import CluesStep from './steps/CluesStep';
import InviteStep from './steps/InviteStep';
import KickoffStep from './steps/KickoffStep';
import MapStep from './steps/MapStep';
import PlaytestStep from './steps/PlaytestStep';
import RewardStep from './steps/RewardStep';
import ShapeStep from './steps/ShapeStep';
import ThemeStep from './steps/ThemeStep';

type Phase = 'kickoff' | 'steps';

interface Props {
  onCreated: (huntId: string) => void;
}

export default function QuestWizard({ onCreated }: Props) {
  const [phase, setPhase] = useState<Phase>('kickoff');
  const [stepIdx, setStepIdx] = useState(0);
  const [draft, setDraft] = useState<HuntDraft>(() => defaultDraft());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goto = (i: number) =>
    setStepIdx(Math.max(0, Math.min(STEPS.length - 1, i)));

  const setField = <K extends keyof HuntDraft>(k: K, v: HuntDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const addStop = (s: SuggestedStop) =>
    setDraft((d) => ({
      ...d,
      stops: [...d.stops, { ...s, chosen: true, order: d.stops.length + 1 }],
      suggestions: d.suggestions.filter((x) => x.id !== s.id),
    }));

  const removeStop = (id: string) =>
    setDraft((d) => {
      const removed = d.stops.find((s) => s.id === id);
      const rest = d.stops
        .filter((s) => s.id !== id)
        .map((s, i) => ({ ...s, order: i + 1 }));
      return {
        ...d,
        stops: rest,
        suggestions: removed
          ? [{ ...removed, chosen: false, suggested: true }, ...d.suggestions]
          : d.suggestions,
      };
    });

  const onRegenStops = (stops: SuggestedStop[]) =>
    setDraft((d) => ({ ...d, stops, suggestions: [] }));

  async function publish() {
    setSubmitting(true);
    setError(null);
    try {
      const { input } = draftToHuntConfig(draft);
      const result: CreateHuntResult = await createHunt(input);
      onCreated(result.hunt.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === 'kickoff') {
    return (
      <div style={{ height: '100%' }}>
        <KickoffStep
          draft={draft}
          onDraft={(next) => {
            setDraft(next);
            setPhase('steps');
            setStepIdx(0);
          }}
          onSkip={() => {
            setPhase('steps');
            setStepIdx(0);
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="ab"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Sidebar
          stepIdx={stepIdx}
          goto={goto}
          draft={draft}
          onRestart={() => setPhase('kickoff')}
        />
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            background: 'var(--bg)',
          }}
        >
          <StepBody
            stepIdx={stepIdx}
            draft={draft}
            set={setField}
            setDraft={setDraft}
            addStop={addStop}
            removeStop={removeStop}
            onRegenStops={onRegenStops}
          />
          <Footer
            stepIdx={stepIdx}
            goto={goto}
            draft={draft}
            submitting={submitting}
            error={error}
            onPublish={publish}
          />
        </main>
      </div>
    </div>
  );
}

interface SidebarProps {
  stepIdx: number;
  goto: (i: number) => void;
  draft: HuntDraft;
  onRestart: () => void;
}

function Sidebar({ stepIdx, goto, draft, onRestart }: SidebarProps) {
  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        borderRight: '1px solid var(--line)',
        background: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 18px',
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <div className="label" style={{ marginBottom: 4 }}>
          New hunt
        </div>
        <div
          className="serif"
          style={{ fontSize: 22, lineHeight: 1.1, color: 'var(--ink)' }}
        >
          {draft.title || 'Untitled'}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--muted)',
            marginTop: 4,
            fontStyle: 'italic',
            fontFamily: 'var(--serif)',
          }}
        >
          for {draft.recipient || '—'}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          marginTop: 4,
          overflowY: 'auto',
        }}
      >
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className={'step ' + (i < stepIdx ? 'done' : i === stepIdx ? 'current' : '')}
            onClick={() => goto(i)}
          >
            <div className="step-dot">
              {i < stepIdx ? <Icon name="check" size={11} stroke={2} /> : s.n}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 13.5 }}>{s.title}</div>
              <div
                style={{ fontSize: 11, color: 'var(--muted-2)', marginTop: 1 }}
              >
                {s.subtitle}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          borderTop: '1px solid var(--line)',
          paddingTop: 14,
          marginTop: 14,
          display: 'flex',
          gap: 8,
        }}
      >
        <button
          className="btn btn-ghost"
          onClick={onRestart}
          style={{
            flex: 1,
            justifyContent: 'center',
            fontSize: 12,
            padding: '8px 10px',
          }}
        >
          <Icon name="spark" size={13} /> From prompt
        </button>
      </div>
    </aside>
  );
}

interface StepBodyProps {
  stepIdx: number;
  draft: HuntDraft;
  set: <K extends keyof HuntDraft>(k: K, v: HuntDraft[K]) => void;
  setDraft: React.Dispatch<React.SetStateAction<HuntDraft>>;
  addStop: (s: SuggestedStop) => void;
  removeStop: (id: string) => void;
  onRegenStops: (stops: SuggestedStop[]) => void;
}

function StepBody({
  stepIdx,
  draft,
  set,
  setDraft,
  addStop,
  removeStop,
  onRegenStops,
}: StepBodyProps) {
  const step = STEPS[stepIdx];
  switch (step.id) {
    case 'basics':
      return <BasicsStep draft={draft} set={set} />;
    case 'city':
      return <CityStep draft={draft} set={set} onRegenStops={onRegenStops} />;
    case 'theme':
      return <ThemeStep draft={draft} set={set} />;
    case 'shape':
      return <ShapeStep draft={draft} set={set} />;
    case 'map':
      return (
        <MapStep
          draft={draft}
          addStop={addStop}
          removeStop={removeStop}
          onRegenStops={onRegenStops}
        />
      );
    case 'clues':
      return <CluesStep draft={draft} setDraft={setDraft} />;
    case 'reward':
      return <RewardStep draft={draft} setDraft={setDraft} />;
    case 'invite':
      return <InviteStep draft={draft} setDraft={setDraft} />;
    case 'playtest':
      return <PlaytestStep draft={draft} />;
    default:
      return null;
  }
}

interface FooterProps {
  stepIdx: number;
  goto: (i: number) => void;
  draft: HuntDraft;
  submitting: boolean;
  error: string | null;
  onPublish: () => void;
}

function Footer({ stepIdx, goto, draft, submitting, error, onPublish }: FooterProps) {
  const step = STEPS[stepIdx];
  const isMap = step.id === 'map';
  const isLast = stepIdx === STEPS.length - 1;
  return (
    <footer
      style={{
        borderTop: '1px solid var(--line)',
        background: 'var(--paper)',
        padding: '14px 28px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
        Step <span className="mono" style={{ color: 'var(--ink-2)' }}>{step.n}</span> of{' '}
        <span className="mono">{String(STEPS.length).padStart(2, '0')}</span>
      </div>
      <div style={{ flex: 1 }} />
      {error && (
        <span
          className="mono"
          style={{
            fontSize: 11,
            color: 'var(--terra)',
            marginRight: 8,
          }}
        >
          {error}
        </span>
      )}
      {isMap && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            fontSize: 12,
            color: 'var(--muted)',
          }}
        >
          <span className="chip chip-moss">
            <Icon name="walking" size={11} /> 1.8 km · ~2h
          </span>
          <span className="chip">
            <Icon name="pin" size={11} /> {draft.stops.length} stops
          </span>
        </div>
      )}
      <button
        className="btn btn-ghost"
        onClick={() => goto(stepIdx - 1)}
        style={{ visibility: stepIdx === 0 ? 'hidden' : 'visible' }}
      >
        <Icon name="arrow-l" size={14} /> Back
      </button>
      <button
        className={'btn ' + (isLast ? 'btn-terra' : 'btn-primary')}
        onClick={() => (isLast ? onPublish() : goto(stepIdx + 1))}
        disabled={submitting}
      >
        {isLast ? (
          submitting ? (
            <>Publishing…</>
          ) : (
            <>
              Publish hunt <Icon name="send" size={14} />
            </>
          )
        ) : (
          <>
            Continue <Icon name="arrow-r" size={14} />
          </>
        )}
      </button>
    </footer>
  );
}
