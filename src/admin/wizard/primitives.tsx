// Shared bits used by multiple wizard step components.

import type { CSSProperties, ReactNode } from 'react';
import Icon from '../Icon';

interface StepPageProps {
  step: { n: string; title: string };
  intro?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  maxWidth?: number | string;
}

export function StepPage({ step, intro, children, wide = false, maxWidth }: StepPageProps) {
  const mw = maxWidth != null ? maxWidth : wide ? '100%' : 720;
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '36px 48px' }}>
      <div style={{ maxWidth: mw, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 6 }}>
          <div
            className="mono"
            style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.12em' }}
          >
            STEP {step.n}
          </div>
          <div style={{ width: 28, height: 1, background: 'var(--line-2)' }} />
        </div>
        <h1
          className="serif"
          style={{ fontSize: 44, lineHeight: 1.05, margin: 0, color: 'var(--ink)' }}
        >
          {step.title}
        </h1>
        {intro && (
          <p
            style={{
              fontSize: 16,
              color: 'var(--muted)',
              maxWidth: 540,
              marginTop: 12,
              lineHeight: 1.5,
            }}
          >
            {intro}
          </p>
        )}
        <div style={{ marginTop: 32 }}>{children}</div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
  style?: CSSProperties;
}

export function Field({ label, hint, children, style }: FieldProps) {
  return (
    <div style={style}>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{label}</div>
        {hint && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{hint}</div>
        )}
      </div>
      {children}
    </div>
  );
}

interface AiNudgeProps {
  children: ReactNode;
}

export function AiNudge({ children }: AiNudgeProps) {
  return (
    <div
      style={{
        marginTop: 32,
        padding: '14px 16px',
        background: 'var(--bg-2)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: 'var(--ink)',
          color: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name="spark" size={13} />
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-2)' }}>{children}</div>
    </div>
  );
}

// Useful little hook for staged content reveals.
import { useEffect, useState } from 'react';

export function useStaggered(count: number, delay = 60): number {
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    setVisible(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setVisible(i);
      if (i >= count) clearInterval(id);
    }, delay);
    return () => clearInterval(id);
  }, [count, delay]);
  return visible;
}
