// Install affordance for both Android/Chromium (beforeinstallprompt) and
// iOS Safari (manual instructions). Dismissed state persists 7 days via
// localStorage so we don't nag users on every visit.

import { useEffect, useState } from 'react';

const SUPPRESS_KEY = 'goodloot-install-suppress-until';
const SUPPRESS_DAYS = 7;

// Minimal subset of BeforeInstallPromptEvent we use.
interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // PWA installed → matchMedia 'display-mode: standalone' or iOS legacy flag
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS Safari sets navigator.standalone — non-standard but widely supported
  return Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function isSuppressed(): boolean {
  try {
    const raw = localStorage.getItem(SUPPRESS_KEY);
    if (!raw) return false;
    const until = parseInt(raw, 10);
    if (!Number.isFinite(until)) return false;
    return Date.now() < until;
  } catch {
    return false;
  }
}

function suppress(): void {
  try {
    localStorage.setItem(
      SUPPRESS_KEY,
      String(Date.now() + SUPPRESS_DAYS * 24 * 60 * 60 * 1000),
    );
  } catch {
    /* ignore: private mode etc. */
  }
}

export default function InstallPrompt() {
  const [bipEvent, setBipEvent] = useState<BIPEvent | null>(null);
  const [iosShow, setIosShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone() || isSuppressed()) {
      setDismissed(true);
      return;
    }

    function onBip(e: Event) {
      e.preventDefault();
      setBipEvent(e as BIPEvent);
    }
    window.addEventListener('beforeinstallprompt', onBip);

    // iOS path — fire after a short delay so the page settles first.
    const iosHandle = isIosSafari()
      ? window.setTimeout(() => setIosShow(true), 1200)
      : null;

    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      if (iosHandle != null) window.clearTimeout(iosHandle);
    };
  }, []);

  if (dismissed) return null;
  if (!bipEvent && !iosShow) return null;

  const onInstall = async () => {
    if (bipEvent) {
      await bipEvent.prompt();
      const choice = await bipEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setDismissed(true);
      } else {
        suppress();
        setDismissed(true);
      }
    }
  };

  const onLater = () => {
    suppress();
    setDismissed(true);
  };

  return (
    <div
      data-testid="install-prompt"
      role="dialog"
      aria-label="install goodLoot"
      style={{
        position: 'fixed',
        bottom: 'max(env(safe-area-inset-bottom), 16px)',
        left: 12,
        right: 12,
        zIndex: 80,
        background: 'rgba(31, 20, 48, 0.96)',
        color: '#FFD89C',
        border: '1px solid rgba(255, 216, 156, 0.22)',
        borderRadius: 16,
        padding: '14px 16px',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 420,
        marginInline: 'auto',
        fontSize: 13,
        lineHeight: 1.4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span aria-hidden style={{ fontSize: 22 }}>📦</span>
        <strong style={{ fontSize: 14 }}>Install goodLoot</strong>
        <button
          onClick={onLater}
          aria-label="dismiss"
          data-testid="install-dismiss"
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            color: 'inherit',
            border: 'none',
            opacity: 0.6,
            cursor: 'pointer',
            fontSize: 16,
          }}
        >
          ✕
        </button>
      </div>
      {bipEvent ? (
        <>
          <span style={{ opacity: 0.8 }}>
            Add goodLoot to your home screen for fullscreen play and push
            notifications.
          </span>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={onLater}
              style={{
                background: 'transparent',
                color: '#FFD89C',
                border: '1px solid rgba(255, 216, 156, 0.3)',
                borderRadius: 10,
                padding: '6px 14px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Not now
            </button>
            <button
              onClick={onInstall}
              data-testid="install-accept"
              style={{
                background: '#FFD89C',
                color: '#1F1430',
                border: 'none',
                borderRadius: 10,
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Install
            </button>
          </div>
        </>
      ) : (
        // iOS instructions
        <span style={{ opacity: 0.85 }}>
          Tap{' '}
          <span
            aria-label="share button"
            style={{
              display: 'inline-block',
              padding: '0 4px',
              borderRadius: 4,
              background: 'rgba(255, 216, 156, 0.18)',
            }}
          >
            ⬆️
          </span>
          , then <strong>Add to Home Screen</strong>.
        </span>
      )}
    </div>
  );
}
