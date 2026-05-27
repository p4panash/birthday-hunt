// Trove-styled admin SPA. Tokens + components ported from
// treasure-hunt-ui-source/. Same three views as before (list / create / detail)
// but wrapped in the Trove sidebar shell.

import { useCallback, useEffect, useState } from 'react';
import { config as soloConfig } from '../config';
import {
  createHunt,
  createTeam,
  getHunt,
  listAuditLog,
  listHunts,
  patchHunt,
  sendTeamAction,
  wipeTeamChat,
  type AuditEntry,
  type HuntSummary,
  type TeamSummary,
} from './adminApi';
import Icon from './Icon';
import './trove.css';

type View =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'detail'; huntId: string }
  | { kind: 'history' };

function parseView(): View {
  const m = window.location.pathname.match(/\/admin\/hunts\/([^/]+)/);
  if (m) return { kind: 'detail', huntId: decodeURIComponent(m[1]) };
  if (window.location.pathname.endsWith('/admin/new')) return { kind: 'create' };
  if (window.location.pathname.endsWith('/admin/history')) return { kind: 'history' };
  return { kind: 'list' };
}

function navigate(view: View) {
  let path = '/admin';
  if (view.kind === 'create') path = '/admin/new';
  if (view.kind === 'detail')
    path = `/admin/hunts/${encodeURIComponent(view.huntId)}`;
  if (view.kind === 'history') path = '/admin/history';
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function AdminApp() {
  const [view, setView] = useState<View>(() => parseView());

  useEffect(() => {
    const onPop = () => setView(parseView());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return (
    <div className="trove">
      <div className="shell">
        <Sidebar view={view} />
        <main className="main">
          {view.kind === 'list' && <HuntsList />}
          {view.kind === 'create' && <CreateHunt />}
          {view.kind === 'detail' && <HuntDetail huntId={view.huntId} />}
          {view.kind === 'history' && <AuditHistory />}
        </main>
      </div>
    </div>
  );
}

// ── Shell ────────────────────────────────────────────────────────────

function Sidebar({ view }: { view: View }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">T</div>
        <div>
          <div className="serif" style={{ fontSize: 19, lineHeight: 1 }}>
            Trove
          </div>
          <div
            className="mono"
            style={{
              fontSize: 9.5,
              color: 'var(--muted)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            birthday-hunt admin
          </div>
        </div>
      </div>

      <div style={{ marginTop: 28, marginBottom: 18 }}>
        <div className="label" style={{ marginBottom: 4 }}>
          Admin
        </div>
        <div
          className="serif"
          style={{ fontSize: 22, lineHeight: 1.1, color: 'var(--ink)' }}
        >
          Hunts dashboard
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
          create, edit, share invite codes
        </div>
      </div>

      <nav
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          marginTop: 4,
        }}
      >
        <button
          className={'step ' + (view.kind === 'list' ? 'current' : '')}
          onClick={() => navigate({ kind: 'list' })}
        >
          <Icon name="map" size={14} />
          <span>all hunts</span>
        </button>
        <button
          className={'step ' + (view.kind === 'create' ? 'current' : '')}
          onClick={() => navigate({ kind: 'create' })}
        >
          <Icon name="plus" size={14} />
          <span>new hunt</span>
        </button>
        <button
          className={'step ' + (view.kind === 'history' ? 'current' : '')}
          onClick={() => navigate({ kind: 'history' })}
        >
          <Icon name="clock" size={14} />
          <span>history</span>
        </button>
        {view.kind === 'detail' && (
          <button className="step current">
            <Icon name="edit" size={14} />
            <span>hunt detail</span>
          </button>
        )}
      </nav>

      <div
        className="hairline"
        style={{ paddingTop: 14, marginTop: 14, fontSize: 11, color: 'var(--muted)' }}
      >
        live · polls every 2s
      </div>
    </aside>
  );
}

// ── Views ────────────────────────────────────────────────────────────

function HuntsList() {
  const [hunts, setHunts] = useState<HuntSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listHunts()
      .then((r) => setHunts(r.hunts))
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <PageHeader
      eyebrow="hunts"
      title="all hunts"
      intro="every hunt you've created lives here. tap one to manage teams and edit copy."
      actions={
        <button
          className="btn btn-primary"
          onClick={() => navigate({ kind: 'create' })}
        >
          <Icon name="plus" size={14} /> new hunt
        </button>
      }
    >
      {error && <p className="alert">{error}</p>}
      {!hunts && !error && <p style={{ opacity: 0.6 }}>loading…</p>}
      {hunts && hunts.length === 0 && (
        <p style={{ opacity: 0.7 }}>no hunts yet — create your first.</p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {hunts?.map((h) => (
          <li
            key={h.id}
            className="card"
            style={{
              padding: '16px 20px',
              marginBottom: 10,
              cursor: 'pointer',
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              alignItems: 'baseline',
            }}
            onClick={() => navigate({ kind: 'detail', huntId: h.id })}
          >
            <div>
              <div
                className="serif"
                style={{ fontSize: 22, lineHeight: 1.1 }}
              >
                {h.name}
              </div>
              <div
                style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}
              >
                for {h.friend_name} · deadline{' '}
                <span className="mono" style={{ fontSize: 11 }}>
                  {h.deadline_iso}
                </span>
              </div>
            </div>
            <div className="chip chip-mono">{h.id.slice(0, 8)}</div>
          </li>
        ))}
      </ul>
    </PageHeader>
  );
}

function CreateHunt() {
  const [name, setName] = useState('');
  const [friendName, setFriendName] = useState(soloConfig.friendName);
  const [deadline, setDeadline] = useState(soloConfig.deadlineISO);
  const [configJson, setConfigJson] = useState(() =>
    JSON.stringify(soloConfig, null, 2),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const parsedConfig = JSON.parse(configJson);
      const res = await createHunt({
        name: name.trim(),
        friend_name: friendName.trim(),
        deadline_iso: deadline.trim(),
        config: parsedConfig,
      });
      navigate({ kind: 'detail', huntId: res.hunt.id });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [name, friendName, deadline, configJson]);

  return (
    <PageHeader
      eyebrow="step 01"
      title="new hunt"
      intro="basics first — the name, the recipient, when the locker takes the gift back. config below is pre-filled from your solo defaults."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field
          label="name (slug, e.g. mihali-bday-2026)"
          hint="lowercase, dashes, no spaces"
        >
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="friend name" hint="who's the hunt for?">
          <input
            className="input"
            value={friendName}
            onChange={(e) => setFriendName(e.target.value)}
          />
        </Field>
        <Field
          label="deadline (ISO 8601)"
          hint="when the locker auto-returns the gift — drives the countdown banner"
        >
          <input
            className="input mono"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </Field>
        <Field
          label="hunt config (JSON)"
          hint="checkpoints, copy, easybox location — everything in src/config.ts"
        >
          <textarea
            className="textarea mono-textarea"
            value={configJson}
            onChange={(e) => setConfigJson(e.target.value)}
            rows={18}
          />
        </Field>
        {error && <p className="alert">{error}</p>}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button
            className="btn btn-ghost"
            onClick={() => navigate({ kind: 'list' })}
          >
            <Icon name="arrow-l" size={14} /> back
          </button>
          <div style={{ flex: 1 }} />
          <button
            className="btn btn-terra"
            onClick={submit}
            disabled={busy || !name || !friendName}
          >
            {busy ? 'creating…' : 'create hunt'} <Icon name="send" size={14} />
          </button>
        </div>
      </div>
    </PageHeader>
  );
}

function HuntDetail({ huntId }: { huntId: string }) {
  const [data, setData] = useState<{
    hunt: HuntSummary;
    teams: TeamSummary[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [deadlineDraft, setDeadlineDraft] = useState('');
  const [savingDeadline, setSavingDeadline] = useState(false);

  const reload = useCallback(() => {
    getHunt(huntId)
      .then((r) => {
        setData(r);
        setDeadlineDraft((current) => current || r.hunt.deadline_iso);
      })
      .catch((e) => setError((e as Error).message));
  }, [huntId]);

  useEffect(() => {
    reload();
    const id = setInterval(reload, 2000);
    return () => clearInterval(id);
  }, [reload]);

  if (error) return <p className="alert">{error}</p>;
  if (!data) return <p style={{ opacity: 0.6 }}>loading…</p>;

  return (
    <PageHeader
      eyebrow="hunt"
      title={data.hunt.name}
      intro={
        <>
          for <strong>{data.hunt.friend_name}</strong> · teams update live every 2s
        </>
      }
      actions={
        <button
          className="btn btn-ghost"
          onClick={() => navigate({ kind: 'list' })}
        >
          <Icon name="arrow-l" size={14} /> back to hunts
        </button>
      }
    >
      <section
        className="card"
        style={{
          padding: 20,
          marginBottom: 20,
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span className="label">
          <Icon name="clock" size={11} style={{ marginRight: 4 }} /> deadline
        </span>
        <input
          className="input mono"
          value={deadlineDraft}
          onChange={(e) => setDeadlineDraft(e.target.value)}
          style={{ fontSize: 13 }}
        />
        <button
          className="btn btn-primary"
          disabled={savingDeadline}
          onClick={async () => {
            setSavingDeadline(true);
            try {
              await patchHunt(huntId, { deadline_iso: deadlineDraft });
              reload();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setSavingDeadline(false);
            }
          }}
        >
          {savingDeadline ? 'saving…' : 'save'}
        </button>
      </section>

      <section>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 10,
          }}
        >
          <h3
            className="serif"
            style={{ fontSize: 24, margin: 0, lineHeight: 1.1 }}
          >
            teams
          </h3>
          <span
            className="chip chip-moss chip-mono"
            style={{ fontSize: 10 }}
          >
            <Icon name="users" size={10} /> {data.teams.length}
          </span>
        </div>

        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {data.teams.map((t) => (
            <TeamCard key={t.id} team={t} />
          ))}
          {data.teams.length === 0 && (
            <li
              className="card"
              style={{ padding: 16, opacity: 0.6, textAlign: 'center' }}
            >
              no teams yet — create the first one below.
            </li>
          )}
        </ul>

        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 14,
          }}
        >
          <input
            className="input"
            value={newTeamName}
            placeholder="team name (e.g. team-coral)"
            onChange={(e) => setNewTeamName(e.target.value)}
          />
          <button
            className="btn btn-terra"
            disabled={!newTeamName.trim()}
            onClick={async () => {
              try {
                await createTeam(huntId, newTeamName.trim());
                setNewTeamName('');
                reload();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Icon name="plus" size={14} /> add team
          </button>
        </div>
      </section>
    </PageHeader>
  );
}

const JUMP_TARGETS: Array<{
  label: string;
  action: { type: string; [k: string]: unknown };
}> = [
  { label: '⏮ reset to intro', action: { type: 'RESET' } },
  { label: '▶ start hunt', action: { type: 'START_HUNT' } },
  { label: '📍 grant GPS', action: { type: 'GRANT_GPS' } },
  { label: '🔓 unlock 1', action: { type: 'UNLOCK_CHECKPOINT', n: 0 } },
  { label: '🔓 unlock 2', action: { type: 'UNLOCK_CHECKPOINT', n: 1 } },
  { label: '🔓 unlock 3', action: { type: 'UNLOCK_CHECKPOINT', n: 2 } },
  {
    label: '🏁 jump to finale',
    action: { type: 'JUMP_TO_STEP', step: { kind: 'finale' } },
  },
];

function AuditHistory() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function reload() {
      listAuditLog(200)
        .then((r) => setEntries(r.entries))
        .catch((e) => setError((e as Error).message));
    }
    reload();
    const id = setInterval(reload, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <PageHeader
      eyebrow="audit"
      title="history"
      intro="every admin mutation is logged with the actor, action, target, and a redacted payload. polls every 5s."
    >
      {error && <p className="alert">{error}</p>}
      {!entries && !error && <p style={{ opacity: 0.6 }}>loading…</p>}
      {entries && entries.length === 0 && (
        <p style={{ opacity: 0.7 }}>no admin actions yet.</p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {entries?.map((e) => (
          <li
            key={e.id}
            className="card"
            style={{
              padding: '12px 16px',
              marginBottom: 8,
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              gap: 12,
              alignItems: 'baseline',
            }}
          >
            <span
              className="mono"
              style={{ fontSize: 11, color: 'var(--muted)' }}
              title={new Date(e.created_at).toISOString()}
            >
              {new Date(e.created_at).toLocaleString()}
            </span>
            <div>
              <span className="chip chip-moss" style={{ marginRight: 8 }}>
                {e.action}
              </span>
              <span style={{ color: 'var(--ink-2)' }}>{e.admin_email}</span>
              <span style={{ color: 'var(--muted)', marginLeft: 6 }}>
                → <code className="mono" style={{ fontSize: 11 }}>{e.target}</code>
              </span>
              {e.payload_json && (
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: 'var(--muted-2)',
                    marginTop: 4,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {e.payload_json}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </PageHeader>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function TeamCard({ team }: { team: TeamSummary }) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpBusy, setJumpBusy] = useState(false);
  const [jumpError, setJumpError] = useState<string | null>(null);
  const [wipeBusy, setWipeBusy] = useState(false);
  const [wipeStatus, setWipeStatus] = useState<string | null>(null);
  const stepLabel = team.step ?? 'intro';
  const unlocked = team.unlocked_count ?? 0;
  const roster = team.roster ?? [];
  return (
    <li
      className="card"
      style={{
        padding: '14px 18px',
        marginBottom: 10,
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 14,
        alignItems: 'center',
      }}
    >
      <div>
        <div className="serif" style={{ fontSize: 20, lineHeight: 1.1 }}>
          {team.name}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 6,
            flexWrap: 'wrap',
          }}
        >
          <span className="chip">
            <Icon name="users" size={11} /> {team.players ?? 0}{' '}
            {(team.players ?? 0) === 1 ? 'player' : 'players'}
          </span>
          <span className="chip chip-moss">
            <Icon name="walking" size={11} /> {stepLabel}
          </span>
          <span className="chip chip-terra">
            <Icon name="qr" size={11} /> {unlocked}/3 unlocked
          </span>
        </div>
        {roster.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: 6,
              marginTop: 10,
              flexWrap: 'wrap',
            }}
          >
            {roster.map((p) => (
              <span
                key={p.id}
                className="chip"
                style={{ fontSize: 11 }}
                title={`joined ${relativeTime(p.joined_at)} · seen ${relativeTime(p.last_seen_at)}`}
              >
                {p.name}
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: 'var(--muted)',
                    marginLeft: 4,
                  }}
                >
                  · {relativeTime(p.last_seen_at)}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 6,
          position: 'relative',
        }}
      >
        <span
          className="mono"
          style={{ fontSize: 20, letterSpacing: 3, fontWeight: 500 }}
        >
          {team.invite_code}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn-ghost"
            style={{ padding: '4px 10px', fontSize: 11 }}
            onClick={() => {
              void navigator.clipboard?.writeText(team.invite_code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            title="copy just the invite code"
          >
            <Icon name="copy" size={11} /> {copied ? 'copied!' : 'code'}
          </button>
          <button
            className="btn btn-terra"
            style={{ padding: '4px 10px', fontSize: 11 }}
            onClick={() => {
              const url = `${window.location.origin}/join?invite=${encodeURIComponent(team.invite_code)}`;
              void navigator.clipboard?.writeText(url);
              setShared(true);
              setTimeout(() => setShared(false), 1800);
            }}
            title="copy a one-tap join link"
          >
            <Icon name="link" size={11} /> {shared ? 'link copied!' : 'share link'}
          </button>
          <button
            className="btn btn-ghost"
            style={{ padding: '4px 10px', fontSize: 11 }}
            onClick={() => setJumpOpen((v) => !v)}
            title="jump this team to a step (debug)"
          >
            <Icon name="settings" size={11} /> jump
          </button>
          <button
            className="btn btn-ghost"
            style={{ padding: '4px 10px', fontSize: 11 }}
            disabled={wipeBusy}
            data-testid={`wipe-chat-${team.id}`}
            onClick={async () => {
              const confirmed = window.confirm(
                `Wipe all chat for team "${team.name}"? This cannot be undone.`,
              );
              if (!confirmed) return;
              setWipeBusy(true);
              setWipeStatus(null);
              try {
                const res = await wipeTeamChat(team.hunt_id, team.id);
                setWipeStatus(`Wiped ${res.wiped} message${res.wiped === 1 ? '' : 's'}`);
                setTimeout(() => setWipeStatus(null), 2400);
              } catch (e) {
                setWipeStatus(`Error: ${(e as Error).message}`);
              } finally {
                setWipeBusy(false);
              }
            }}
            title="delete all chat messages for this team"
          >
            <Icon name="x" size={11} /> {wipeBusy ? 'wiping…' : 'wipe chat'}
          </button>
        </div>
        {wipeStatus && (
          <div
            style={{
              fontSize: 11,
              color: wipeStatus.startsWith('Error')
                ? 'var(--terra-2)'
                : 'var(--moss-2)',
              marginTop: 4,
            }}
          >
            {wipeStatus}
          </div>
        )}
        {jumpOpen && (
          <div
            className="card"
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 6,
              padding: 8,
              minWidth: 180,
              zIndex: 10,
              boxShadow: 'var(--shadow-2)',
            }}
          >
            {JUMP_TARGETS.map((t) => (
              <button
                key={t.label}
                disabled={jumpBusy}
                className="step"
                style={{ width: '100%', fontSize: 12, padding: '6px 8px' }}
                onClick={async () => {
                  setJumpBusy(true);
                  setJumpError(null);
                  try {
                    await sendTeamAction(team.hunt_id, team.id, t.action);
                    setJumpOpen(false);
                  } catch (e) {
                    setJumpError((e as Error).message);
                  } finally {
                    setJumpBusy(false);
                  }
                }}
              >
                {t.label}
              </button>
            ))}
            {jumpError && (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--terra-2)',
                  marginTop: 6,
                  padding: '4px 8px',
                }}
              >
                {jumpError}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

// ── Atoms ────────────────────────────────────────────────────────────

function PageHeader({
  eyebrow,
  title,
  intro,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ maxWidth: 860 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 14,
          marginBottom: 6,
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: 'var(--muted)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{ width: 28, height: 1, background: 'var(--line-2)' }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 18,
          marginBottom: 22,
        }}
      >
        <h1
          className="serif"
          style={{ fontSize: 44, lineHeight: 1.05, margin: 0, flex: 1 }}
        >
          {title}
        </h1>
        {actions && <div style={{ paddingTop: 6 }}>{actions}</div>}
      </div>
      {intro && (
        <p
          style={{
            fontSize: 16,
            color: 'var(--muted)',
            maxWidth: 540,
            margin: '0 0 28px 0',
            lineHeight: 1.5,
          }}
        >
          {intro}
        </p>
      )}
      <div>{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="label">{label}</span>
      {children}
      {hint && (
        <span
          style={{
            fontSize: 12,
            color: 'var(--muted-2)',
            fontStyle: 'italic',
            fontFamily: 'var(--serif)',
          }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}
