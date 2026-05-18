/**
 * Hunt state machine.
 *
 * Strict linear flow: intro → gps-preface → location(0) → reveal(0)
 *                  → location(1) → reveal(1) → location(2) → reveal(2) → finale
 *
 * Photo interstitials are inserted between reveal(n) and location(n+1) only
 * if config.photos has an entry with afterStep === n. With config.photos === []
 * (v1 default) the reveal → next-location transition is direct.
 *
 * The schema version is encoded in STORAGE_KEY; bump if HuntState shape changes.
 */

export type CheckpointIndex = 0 | 1 | 2;

export type HuntStep =
  | { kind: 'intro' }
  | { kind: 'gps-preface' }
  | { kind: 'location'; n: CheckpointIndex }
  | { kind: 'reveal'; n: CheckpointIndex }
  | { kind: 'photo'; afterN: CheckpointIndex }
  | { kind: 'finale' };

export type HuntState = {
  step: HuntStep;
  unlocked: [boolean, boolean, boolean];
  startedAt: number | null;
  testMode: boolean;
};

export type HuntAction =
  | { type: 'START_HUNT' }
  | { type: 'GRANT_GPS' }
  | { type: 'DENY_GPS' }
  | { type: 'UNLOCK_CHECKPOINT'; n: CheckpointIndex }
  | { type: 'REVEAL_COMPLETE'; n: CheckpointIndex; hasPhotoAfter: boolean }
  | { type: 'PHOTO_DONE'; afterN: CheckpointIndex }
  | { type: 'RESET' }
  | { type: 'JUMP_TO_STEP'; step: HuntStep }
  | { type: 'SET_TEST_MODE'; testMode: boolean };

export const STORAGE_KEY = 'bday-hunt-v1';

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
    case 'DENY_GPS':
      // Both routes proceed to the first checkpoint; the difference (whether to
      // pre-expand the stuck sheet's code field) is handled by the screen itself
      // reading the latest geolocation permission state.
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

    case 'SET_TEST_MODE':
      return { ...state, testMode: action.testMode };

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
