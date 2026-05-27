// Tiny opt-in pill: "Enable notifications" → subscribed → "Notifications on".
// Hidden when push isn't supported (older browsers, iOS Safari before 16.4
// PWA install). Positioned next to the chat fab; we accept inline placement
// rather than fighting the layout.

import { usePush } from './usePush';

interface Props {
  teamId: string;
  playerId: string;
}

export default function PushOptInPill({ teamId, playerId }: Props) {
  const { supported, subscribed, busy, error, enable, disable } = usePush({
    teamId,
    playerId,
  });

  if (!supported) return null;

  const label = busy
    ? '…'
    : subscribed
      ? '🔔 on'
      : '🔕 enable';

  return (
    <button
      onClick={subscribed ? disable : enable}
      disabled={busy}
      data-testid="push-toggle"
      aria-label={subscribed ? 'disable push notifications' : 'enable push notifications'}
      title={error ?? (subscribed ? 'Notifications enabled — tap to disable' : 'Enable notifications')}
      style={{
        background: 'rgba(31, 20, 48, 0.78)',
        color: subscribed ? '#9BD89C' : '#FFD89C',
        border: `1px solid ${subscribed ? 'rgba(155, 216, 156, 0.4)' : 'rgba(255, 216, 156, 0.18)'}`,
        borderRadius: 999,
        padding: '6px 10px',
        fontSize: 11,
        fontFamily: 'inherit',
        backdropFilter: 'blur(8px)',
        cursor: busy ? 'wait' : 'pointer',
      }}
    >
      {label}
    </button>
  );
}
