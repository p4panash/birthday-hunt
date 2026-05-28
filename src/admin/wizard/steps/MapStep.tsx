import { useCallback, useState } from 'react';
import Icon from '../../Icon';
import type { HuntDraft, SuggestedStop } from '../data';
import WizardMap from '../WizardMap';

interface Props {
  draft: HuntDraft;
  addStop: (s: SuggestedStop) => void;
  removeStop: (id: string) => void;
}

export default function MapStep({ draft, addStop, removeStop }: Props) {
  const [selectedId, setSelected] = useState<string | null>(draft.stops[0]?.id ?? null);
  const [hoveredId, setHovered] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      {/* — left panel: stops & search — */}
      <div
        style={{
          width: 360,
          flexShrink: 0,
          borderRight: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--paper)',
        }}
      >
        <div style={{ padding: '20px 20px 16px' }}>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--muted)',
              letterSpacing: '0.12em',
              marginBottom: 6,
            }}
          >
            STEP 05
          </div>
          <h1 className="serif" style={{ fontSize: 30, lineHeight: 1.05, margin: 0 }}>
            Pick the stops
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--muted)',
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            We've sketched a route. Drag to reorder, swap in any of the soft suggestions on
            the map, or search for somewhere we missed.
          </p>
        </div>

        <div style={{ padding: '0 20px 14px', position: 'relative' }}>
          <Icon
            name="search"
            size={15}
            color="var(--muted)"
            style={{
              position: 'absolute',
              left: 32,
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          />
          <input
            className="input"
            placeholder="Search a place…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 38, fontSize: 13 }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 14px' }}>
          <div
            className="label"
            style={{
              padding: '6px 6px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            Route · {draft.stops.length} stops
            <span style={{ flex: 1 }} />
            <span
              style={{
                textTransform: 'none',
                fontSize: 11,
                color: 'var(--muted-2)',
                letterSpacing: 0,
              }}
              className="mono"
            >
              1.8 km
            </span>
          </div>
          {draft.stops.map((s, i) => (
            <StopCard
              key={s.id}
              s={s}
              i={i}
              selected={selectedId === s.id}
              onSelect={() => setSelected(s.id)}
              onRemove={() => removeStop(s.id)}
              onHover={setHovered}
            />
          ))}

          <div className="label" style={{ padding: '18px 6px 8px' }}>
            Suggested by AI
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {draft.suggestions.slice(0, 4).map((s) => (
              <SuggestionCard
                key={s.id}
                s={s}
                onAdd={() => addStop(s)}
                onHover={setHovered}
              />
            ))}
          </div>
        </div>

        <div
          style={{
            borderTop: '1px solid var(--line)',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--bg-2)',
          }}
        >
          <Icon name="walking" size={14} color="var(--muted)" />
          <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>
            Walkable in <b>~28 min</b>
          </span>
          <span style={{ flex: 1 }} />
          <button
            className="btn-quiet btn"
            style={{ fontSize: 12, padding: '6px 8px' }}
          >
            <Icon name="route" size={12} /> Optimize order
          </button>
        </div>
      </div>

      {/* — map canvas — */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          background: 'var(--bg-2)',
        }}
      >
        <WizardMap
          city={draft.city}
          cityCoords={draft.cityCoords}
          stops={draft.stops}
          suggestions={draft.suggestions}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={useCallback((id: string) => setSelected(id), [])}
          onAddSuggestion={useCallback(
            (id: string) => {
              const s = draft.suggestions.find((x) => x.id === id);
              if (s) addStop(s);
            },
            [draft.suggestions, addStop],
          )}
        />

        {selectedId && (
          <StopDetailCard
            stop={draft.stops.find((s) => s.id === selectedId)}
            onClose={() => setSelected(null)}
          />
        )}

        <AISuggestRibbon
          onSuggest={() => {
            const next = draft.suggestions[0];
            if (next) addStop(next);
          }}
        />
      </div>
    </div>
  );
}

interface StopCardProps {
  s: SuggestedStop;
  i: number;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onHover: (id: string | null) => void;
}

function StopCard({ s, i, selected, onSelect, onRemove, onHover }: StopCardProps) {
  return (
    <div
      className="card"
      style={{
        padding: '10px 12px',
        borderColor: selected ? 'var(--terra)' : 'var(--line)',
        background: selected ? 'var(--terra-soft)' : 'var(--paper)',
        marginBottom: 6,
        cursor: 'pointer',
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        transition: 'border-color 120ms, background 120ms',
      }}
      onClick={onSelect}
      onMouseEnter={() => onHover(s.id)}
      onMouseLeave={() => onHover(null)}
    >
      <Icon name="grip" size={14} color="var(--muted-2)" />
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: 'var(--terra)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--mono)',
          fontSize: 12,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {i + 1}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 500,
            color: 'var(--ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {s.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{s.type}</span>
          <span style={{ fontSize: 11, color: 'var(--muted-2)' }}>·</span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }} className="mono">
            {s.time}
          </span>
        </div>
      </div>
      <button
        className="btn-quiet"
        style={{
          width: 26,
          height: 26,
          padding: 0,
          borderRadius: 6,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: 'var(--muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <Icon name="x" size={13} />
      </button>
    </div>
  );
}

interface SuggestionCardProps {
  s: SuggestedStop;
  onAdd: () => void;
  onHover: (id: string | null) => void;
}

function SuggestionCard({ s, onAdd, onHover }: SuggestionCardProps) {
  return (
    <div
      style={{
        padding: '8px 10px',
        borderRadius: 8,
        background: 'transparent',
        border: '1px dashed var(--line-2)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
      }}
      onMouseEnter={() => onHover(s.id)}
      onMouseLeave={() => onHover(null)}
      onClick={onAdd}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          border: '1.5px dashed var(--terra)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name="plus" size={11} color="var(--terra)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--ink-2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {s.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
          {s.type} · {s.time}
        </div>
      </div>
      <span
        className="mono"
        style={{ fontSize: 10, color: 'var(--muted-2)', letterSpacing: '0.06em' }}
      >
        ADD
      </span>
    </div>
  );
}

interface StopDetailCardProps {
  stop?: SuggestedStop;
  onClose: () => void;
}

function StopDetailCard({ stop, onClose }: StopDetailCardProps) {
  if (!stop) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 20,
        bottom: 78,
        width: 280,
        background: 'var(--paper)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-3)',
        border: '1px solid var(--line)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: 100,
          background:
            'repeating-linear-gradient(135deg, oklch(0.93 0.04 50) 0 14px, oklch(0.90 0.05 45) 14px 28px)',
          display: 'flex',
          alignItems: 'flex-end',
          padding: 12,
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          className="btn-quiet"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 26,
            height: 26,
            padding: 0,
            borderRadius: '50%',
            background: 'var(--paper)',
            border: '1px solid var(--line)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ink)',
          }}
        >
          <Icon name="x" size={12} />
        </button>
        <span className="chip chip-mono" style={{ background: 'var(--paper)' }}>
          place · photo
        </span>
      </div>
      <div style={{ padding: '14px 16px 16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <div className="serif" style={{ fontSize: 22, lineHeight: 1.1 }}>
            {stop.name}
          </div>
          <span className="chip chip-mono">#{stop.order}</span>
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--muted)',
            marginTop: 4,
            display: 'flex',
            gap: 8,
          }}
        >
          <span>{stop.type}</span>
          <span>·</span>
          <span>{stop.tag}</span>
        </div>
        <p
          style={{
            fontSize: 13,
            color: 'var(--ink-2)',
            marginTop: 10,
            lineHeight: 1.55,
          }}
        >
          {stop.blurb}
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            className="btn btn-ghost"
            style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
          >
            <Icon name="edit" size={12} /> Edit clue
          </button>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: '8px 10px' }}
          >
            <Icon name="route" size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function AISuggestRibbon({ onSuggest }: { onSuggest: () => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        right: 18,
        top: 76,
        width: 280,
        background: 'var(--paper)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-2)',
        border: '1px solid var(--line)',
        padding: '12px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: 'var(--ink)',
            color: 'var(--bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="spark" size={11} />
        </div>
        <div
          className="mono"
          style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}
        >
          TROVE ASSIST
        </div>
      </div>
      <p
        style={{
          fontSize: 13,
          lineHeight: 1.5,
          color: 'var(--ink-2)',
          margin: '10px 0 12px',
        }}
      >
        Stop 5 ends in the north. Adding <b>Form Space</b> here makes the finale a short
        uphill drink, not a 1km return walk.
      </p>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          className="btn btn-primary"
          style={{ fontSize: 12, padding: '7px 10px' }}
          onClick={onSuggest}
        >
          Add stop
        </button>
        <button
          className="btn btn-quiet"
          style={{ fontSize: 12, padding: '7px 10px' }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
