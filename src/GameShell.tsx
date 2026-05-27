// Shared game UI shell. Both SoloMode and TeamMode mount this with their own
// state + dispatch source. Behaviour is identical — only the upstream of
// state changes differs.

import type { CheckpointIndex, HuntAction, HuntState } from './state/huntReducer';
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

interface Props {
  state: HuntState;
  dispatch: React.Dispatch<HuntAction>;
  sliceUrls: [string, string, string] | null;
}

export default function GameShell({ state, dispatch, sliceUrls }: Props) {
  const showChrome =
    state.step.kind !== 'intro' && state.step.kind !== 'gps-preface';
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
      return Math.min(2, state.step.afterN + 1) as CheckpointIndex;
    default:
      return null;
  }
}

function Router({ state, dispatch, sliceUrls }: Props) {
  const { step } = state;
  switch (step.kind) {
    case 'intro':
      return <Intro dispatch={dispatch} />;
    case 'gps-preface':
      return <GpsPreface dispatch={dispatch} />;
    case 'location':
      return (
        <LocationActive
          dispatch={dispatch}
          n={step.n}
          testMode={state.testMode}
        />
      );
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
      return <Finale dispatch={dispatch} testMode={state.testMode} />;
  }
}
