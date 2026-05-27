// Pure hunt-state reducer. Identical logic runs on the frontend (via
// useReducer in solo mode, or useTeamState in team mode) and on the backend
// (inside the TeamSession Durable Object). No DOM, no React, no Node APIs.

import type {
  CheckpointIndex,
  HuntAction,
  HuntState,
  HuntStep,
} from './types';

export const initialState: HuntState = {
  step: { kind: 'intro' },
  unlocked: [false, false, false],
  startedAt: null,
  testMode: false,
};

export function huntReducer(state: HuntState, action: HuntAction): HuntState {
  switch (action.type) {
    case 'START_HUNT':
      return {
        ...state,
        step: { kind: 'gps-preface' },
        startedAt: state.startedAt ?? Date.now(),
      };

    case 'GRANT_GPS':
      return { ...state, step: { kind: 'location', n: 0 } };

    case 'UNLOCK_CHECKPOINT': {
      const unlocked = [...state.unlocked] as HuntState['unlocked'];
      unlocked[action.n] = true;
      return { ...state, step: { kind: 'reveal', n: action.n }, unlocked };
    }

    case 'REVEAL_COMPLETE': {
      const n = action.n;
      if (action.hasPhotoAfter) {
        return { ...state, step: { kind: 'photo', afterN: n } };
      }
      if (n < 2) {
        return { ...state, step: { kind: 'location', n: (n + 1) as CheckpointIndex } };
      }
      return { ...state, step: { kind: 'finale' } };
    }

    case 'PHOTO_DONE': {
      const n = action.afterN;
      if (n < 2) {
        return { ...state, step: { kind: 'location', n: (n + 1) as CheckpointIndex } };
      }
      return { ...state, step: { kind: 'finale' } };
    }

    case 'JUMP_TO_STEP':
      return { ...state, step: action.step };

    case 'RESET':
      return { ...initialState, testMode: state.testMode };

    default:
      return state;
  }
}

/** Type guard for screen routing. */
export function isStepKind<K extends HuntStep['kind']>(
  step: HuntStep,
  kind: K,
): step is Extract<HuntStep, { kind: K }> {
  return step.kind === kind;
}
