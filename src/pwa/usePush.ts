// Push subscription state + actions for the team-mode UI.
//
// Lifecycle:
//   1. Check whether `serviceWorker.ready` resolves (SW registered)
//   2. Check the existing PushSubscription via pushManager.getSubscription()
//   3. enable() requests permission, subscribes, POSTs to Worker
//   4. disable() unsubscribes locally and POSTs to Worker

import { useCallback, useEffect, useState } from 'react';
import { getClientId } from '../lib/clientId';

export interface UsePushResult {
  supported: boolean;
  permission: NotificationPermission | 'unknown';
  subscribed: boolean;
  busy: boolean;
  error: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}

function supportsPush(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

async function fetchVapidPublicKey(): Promise<string> {
  const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
  const res = await fetch(`${apiBase}/api/push/vapid-public-key`);
  if (!res.ok) throw new Error(`vapid key fetch failed: ${res.status}`);
  const { key } = (await res.json()) as { key: string };
  return key;
}

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const pad = b64.length % 4 === 0 ? 0 : 4 - (b64.length % 4);
  const base64 = (b64 + '='.repeat(pad)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function usePush(args: {
  teamId: string;
  playerId: string;
}): UsePushResult {
  const { teamId, playerId } = args;
  const supported = supportsPush();
  const [permission, setPermission] = useState<NotificationPermission | 'unknown'>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unknown',
  );
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setSubscribed(Boolean(sub));
      } catch {
        /* ignore — SW might not be installed yet */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const enable = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setError('Notifications not allowed.');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const key = await fetchVapidPublicKey();
      // ArrayBuffer copy — some lib.dom typings disallow Uint8Array<SharedArrayBuffer>
      // here; the .buffer detour gives us a clean ArrayBuffer view.
      const keyBytes = urlBase64ToUint8Array(key);
      const keyBuf = keyBytes.buffer.slice(0) as ArrayBuffer;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBuf,
      });
      const json = sub.toJSON();
      const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
      const res = await fetch(
        `${apiBase}/api/push/teams/${encodeURIComponent(teamId)}/subscribe`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            player_id: playerId,
            // Sent so the server can verify we own this player identity
            // (matches players.client_id row). Same secret that re-binds
            // the player on rejoin.
            client_id: getClientId(),
            endpoint: sub.endpoint,
            keys: {
              p256dh: json.keys?.p256dh ?? arrayBufferToBase64Url(sub.getKey('p256dh')),
              auth: json.keys?.auth ?? arrayBufferToBase64Url(sub.getKey('auth')),
            },
          }),
        },
      );
      if (!res.ok) {
        await sub.unsubscribe().catch(() => {});
        throw new Error(`subscribe failed: ${res.status}`);
      }
      setSubscribed(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [supported, teamId, playerId]);

  const disable = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setSubscribed(false);
        return;
      }
      // playerId is captured by closure (the outer hook arg).
      const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
      // Tell the server first; if that fails, leave the local sub in place
      // so the user can retry.
      const res = await fetch(
        `${apiBase}/api/push/teams/${encodeURIComponent(teamId)}/unsubscribe`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            player_id: playerId,
            client_id: getClientId(),
            endpoint: sub.endpoint,
          }),
        },
      );
      if (!res.ok) throw new Error(`unsubscribe failed: ${res.status}`);
      await sub.unsubscribe();
      setSubscribed(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [supported, teamId, playerId]);

  return { supported, permission, subscribed, busy, error, enable, disable };
}
