// Cross-environment types and contracts shared between src/ (frontend) and
// worker/ (backend). Anything imported from here must be DOM-free, React-free,
// and Node-free so that both bundles can consume it.

export type {
  CheckpointIndex,
  HuntStep,
  HuntState,
  HuntAction,
} from './state/types';
export {
  CheckpointIndexSchema,
  HuntStepSchema,
  HuntStateSchema,
  HuntActionSchema,
} from './state/schema';

export { huntReducer, initialState, isStepKind } from './state/reducer';

export type { Checkpoint, PhotoConfig, HuntConfig } from './config/types';
export {
  CheckpointSchema,
  PhotoConfigSchema,
  HuntConfigSchema,
} from './config/schema';

export type { PlayerPresence, ClientMsg, ServerMsg } from './messages';
export {
  PROTOCOL_VERSION,
  PlayerPresenceSchema,
  ClientMsgSchema,
  ServerMsgSchema,
} from './messages';
