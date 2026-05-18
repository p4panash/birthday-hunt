import { config } from '../config';

/**
 * Substitute [VAR] placeholders in copy strings.
 *
 *   tpl('hey [FRIEND_NAME]', { FRIEND_NAME: 'Andrei' }) // → 'hey Andrei'
 *
 * Defaults provided for the most common vars; pass extras as needed (e.g.
 * LOCATION_NAME when rendering a checkpoint hint).
 */
export function tpl(input: string, vars: Record<string, string> = {}): string {
  const merged: Record<string, string> = {
    FRIEND_NAME: config.friendName,
    ...vars,
  };
  return input.replace(/\[(\w+)\]/g, (_, key) => merged[key] ?? `[${key}]`);
}
