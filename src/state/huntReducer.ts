/**
 * Hunt state machine — frontend entry point.
 *
 * The state shape, action union, reducer, and initialState live in
 * shared/state/ so the backend can apply the same logic. This file re-exports
 * those bindings under the original import path and adds STORAGE_KEY, which
 * belongs to the solo-mode browser persistence layer and not to the
 * cross-environment contract.
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

export type {
  CheckpointIndex,
  HuntStep,
  HuntState,
  HuntAction,
} from 'shared/state/types';

export {
  huntReducer,
  initialState,
  isStepKind,
} from 'shared/state/reducer';

/** localStorage key for solo-mode persistence. Team mode does not use this. */
export const STORAGE_KEY = 'bday-hunt-v1';
