import { useEffect, useReducer } from 'react';
import {
  STORAGE_KEY,
  huntReducer,
  initialState,
  type CheckpointIndex,
  type HuntState,
} from './state/huntReducer';
import { loadFromStorage, useLocalStorageSync } from './lib/useLocalStorageSync';
import { useQrSlices } from './lib/useQrSlices';
import { detectTestMode } from './lib/testMode';
import PortraitLock from './components/PortraitLock';
import CountdownBanner from './components/CountdownBanner';
import ProgressScaffold from './components/ProgressScaffold';
import TestModeBadge from './components/TestModeBadge';
import Intro from './screens/Intro';
import GpsPreface from './screens/GpsPreface';
import LocationActive from './screens/LocationActive';
import Reveal from './screens/Reveal';
import PhotoInterstitial from './screens/PhotoInterstitial';
import Finale from './screens/Finale';

const QR_SRC = `${import.meta.env.BASE_URL}qr.png`;

function init(seed: HuntState): HuntState {
  const stored = loadFromStorage<HuntState | null>(STORAGE_KEY, null);
  return stored ?? seed;
}

export default function App() {
  const [state, dispatch] = useReducer(huntReducer, initialState, init);
  useLocalStorageSync(STORAGE_KEY, state);
  const sliceUrls = useQrSlices(QR_SRC);

  // Detect test mode once on mount; sync to reducer state.
  useEffect(() => {
    const t = detectTestMode();
    if (t !== state.testMode) {
      dispatch({ type: 'SET_TEST_MODE', testMode: t });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showChrome = state.step.kind !== 'intro' && state.step.kind !== 'gps-preface';
  const currentN = currentCheckpoint(state);
  const revealingN = state.step.kind === 'reveal' ? state.step.n : null;

  return (
    <PortraitLock>
      <div className="app-shell">
        {showChrome && <CountdownBanner />}
        {showChrome && state.step.kind !== 'finale' && (
          <ProgressScaffold
            sliceUrls={sliceUrls}
            unlocked={state.unlocked}
            currentN={currentN}
            revealingN={revealingN}
          />
        )}
        <Router state={state} dispatch={dispatch} sliceUrls={sliceUrls} />
        {state.testMode && (
          <TestModeBadge dispatch={dispatch} currentN={currentN} />
        )}
      </div>
    </PortraitLock>
  );
}

function currentCheckpoint(state: HuntState): CheckpointIndex | null {
  switch (state.step.kind) {
    case 'location':
    case 'reveal':
      return state.step.n;
    case 'photo':
      // After photo, the next location is afterN + 1, capped at 2.
      return Math.min(2, state.step.afterN + 1) as CheckpointIndex;
    default:
      return null;
  }
}

function Router({
  state,
  dispatch,
  sliceUrls,
}: {
  state: HuntState;
  dispatch: React.Dispatch<Parameters<typeof huntReducer>[1]>;
  sliceUrls: [string, string, string] | null;
}) {
  const { step } = state;
  switch (step.kind) {
    case 'intro':
      return <Intro dispatch={dispatch} />;
    case 'gps-preface':
      return <GpsPreface dispatch={dispatch} />;
    case 'location':
      return <LocationActive dispatch={dispatch} n={step.n} />;
    case 'reveal':
      return (
        <Reveal
          dispatch={dispatch}
          n={step.n}
          slice={sliceUrls ? sliceUrls[step.n] : null}
        />
      );
    case 'photo':
      return <PhotoInterstitial dispatch={dispatch} afterN={step.afterN} />;
    case 'finale':
      return <Finale dispatch={dispatch} />;
  }
}
