// Solo mode: the v1 single-player experience. State lives entirely in
// localStorage; no backend touched. This file mirrors the pre-multiplayer
// App.tsx so that disabling team mode immediately falls back to it.

import { useReducer } from 'react';
import {
  STORAGE_KEY,
  huntReducer,
  initialState,
  type HuntState,
} from './state/huntReducer';
import {
  loadFromStorage,
  useLocalStorageSync,
} from './lib/useLocalStorageSync';
import { useQrSlices } from './lib/useQrSlices';
import { detectTestMode } from './lib/testMode';
import GameShell from './GameShell';

const QR_SRC = `${import.meta.env.BASE_URL}qr.jpg`;

function init(seed: HuntState): HuntState {
  const stored = loadFromStorage<HuntState | null>(STORAGE_KEY, null);
  return { ...(stored ?? seed), testMode: detectTestMode() };
}

export default function SoloMode() {
  const [state, dispatch] = useReducer(huntReducer, initialState, init);
  useLocalStorageSync(STORAGE_KEY, state);
  const sliceUrls = useQrSlices(QR_SRC);
  return <GameShell state={state} dispatch={dispatch} sliceUrls={sliceUrls} />;
}
