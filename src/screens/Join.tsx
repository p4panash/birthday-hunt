// Team-mode entry. Player types an invite code + name, the server creates or
// re-binds their player row, and the session lands in localStorage so reloads
// drop straight back into the team-mode shell.

import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, joinTeam } from '../lib/api';
import { getClientId } from '../lib/clientId';
import { saveTeamSession } from '../lib/teamSession';

interface Props {
  onJoined: () => void;
}

/**
 * Read ?invite=CODE from the current URL. Uppercased + trimmed. The admin
 * "share link" button emits this exact format, so a fresh tab opening
 * /join?invite=ABCD1234 lands with the invite field already populated.
 */
function readInviteFromUrl(): string {
  try {
    return (
      new URLSearchParams(window.location.search).get('invite')?.trim().toUpperCase() ?? ''
    );
  } catch {
    return '';
  }
}

export default function Join({ onJoined }: Props) {
  const [code, setCode] = useState(() => readInviteFromUrl());
  const [name, setName] = useState('');

  // If the URL changes mid-session (e.g. user pastes a new invite link), keep
  // the field in sync.
  useEffect(() => {
    function onPop() {
      const next = readInviteFromUrl();
      if (next) setCode(next);
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const result = await joinTeam({
        invite_code: code.trim().toUpperCase(),
        player_name: name.trim(),
        client_id: getClientId(),
      });
      saveTeamSession({
        team_id: result.team.id,
        player_id: result.player.id,
      });
      onJoined();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(messageFor(err.code, err.message));
      } else {
        setError('something went wrong. try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="screen screen--intro" style={{ padding: 24 }}>
      <div className="intro__top">
        <p className="eyebrow">join the hunt</p>
        <h1 className="hero-title">got a code?</h1>
        <p className="intro__body">
          enter your invite code and pick a name. your team will see you join.
        </p>
      </div>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24 }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="eyebrow">invite code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={8}
            placeholder="ABCD1234"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            required
            style={{
              fontFamily: 'monospace',
              fontSize: 24,
              letterSpacing: 4,
              padding: 12,
              textAlign: 'center',
            }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="eyebrow">your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            required
            style={{ fontSize: 18, padding: 12 }}
          />
        </label>
        {error && (
          <p
            role="alert"
            style={{ color: 'var(--coral, #ff6b5b)', margin: 0, fontSize: 14 }}
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !code || !name}
          className="btn-primary"
          style={{ marginTop: 8 }}
        >
          {busy ? 'joining…' : "let's go"}
        </button>
      </form>
    </section>
  );
}

function messageFor(code: string, fallback: string): string {
  switch (code) {
    case 'invalid_invite':
      return 'no team with that code. double-check the letters.';
    case 'validation_error':
      return 'check the invite code format (8 chars, A-Z + digits).';
    default:
      return fallback;
  }
}
