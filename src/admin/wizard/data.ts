// Static seed data for the Quest Wizard. Themes / occasions / starter prompts.
// These shape the AI draft on the kickoff screen and the option grids in the
// subsequent steps. Values may be edited per-hunt before submit.

import type { CSSProperties } from 'react';

export interface StepDef {
  id: StepId;
  n: string;
  title: string;
  subtitle: string;
}

export type StepId =
  | 'basics'
  | 'city'
  | 'theme'
  | 'shape'
  | 'map'
  | 'clues'
  | 'reward'
  | 'invite'
  | 'playtest';

export const STEPS: StepDef[] = [
  { id: 'basics',   n: '01', title: 'Basics',          subtitle: 'Who, what, when' },
  { id: 'city',     n: '02', title: 'City & area',     subtitle: 'Where it all happens' },
  { id: 'theme',    n: '03', title: 'Theme & story',   subtitle: 'Set the mood' },
  { id: 'shape',    n: '04', title: 'Stops & pace',    subtitle: 'Length and difficulty' },
  { id: 'map',      n: '05', title: 'Pick the stops',  subtitle: 'Place pins on the map' },
  { id: 'clues',    n: '06', title: 'Write the clues', subtitle: 'AI-drafted, you edit' },
  { id: 'reward',   n: '07', title: 'Final reward',    subtitle: 'Locker, code, message' },
  { id: 'invite',   n: '08', title: 'Invite hunters',  subtitle: 'Links and QR' },
  { id: 'playtest', n: '09', title: 'Playtest',        subtitle: 'Walk the hunt yourself' },
];

export const KICKOFF_PROMPTS = [
  "Birthday hunt for my girlfriend Mihaela in Cluj — 5 stops in Centru, warm and romantic, ending at a locker on Cetățuia with her gift.",
  "Bachelorette in Brașov for Andra — 6 stops, late-afternoon, a bit cruel on the riddles, ending at a rooftop bar.",
  "Team-building hunt for 14 colleagues in București — Centru Vechi, 4 stops, photo proofs, ending at a pub.",
  "Proposal in Timișoara — 3 quiet stops at dusk, ending at the gazebo in Parcul Central with a sealed envelope.",
];

export const OCCASIONS = [
  { id: 'birthday',     label: 'Birthday',          icon: 'cake' },
  { id: 'anniversary',  label: 'Anniversary',       icon: 'heart' },
  { id: 'proposal',     label: 'Proposal',          icon: 'star' },
  { id: 'bachelor',     label: 'Bachelor / -ette',  icon: 'crown' },
  { id: 'team',         label: 'Team-building',     icon: 'briefcase' },
  { id: 'tourist',      label: 'City tour',         icon: 'camera' },
  { id: 'kids',         label: 'Kids party',        icon: 'balloon' },
  { id: 'just-because', label: 'Just because',      icon: 'sparkle' },
] as const;

export type OccasionId = (typeof OCCASIONS)[number]['id'];

export const CITIES = [
  { id: 'cluj',      name: 'Cluj-Napoca', meta: 'Transylvania · 290k', tag: '163 places curated' },
  { id: 'buc',       name: 'București',   meta: 'Capital · 1.8M',      tag: '412 places curated' },
  { id: 'brasov',    name: 'Brașov',      meta: 'Mountains · 250k',    tag: '94 places curated' },
  { id: 'timisoara', name: 'Timișoara',   meta: 'Banat · 320k',        tag: '128 places curated' },
] as const;

export type CityId = (typeof CITIES)[number]['id'];

// Centre lat/lng + default Leaflet zoom for each supported city.
// Used to centre the real-tile map on Step 05 when no stops have coords
// yet (e.g. before the AI patch arrives, or for a manual setup).
export const CITY_CENTERS: Record<CityId, { lat: number; lng: number; zoom: number }> = {
  cluj:      { lat: 46.7712, lng: 23.6236, zoom: 14 },
  buc:       { lat: 44.4396, lng: 26.0963, zoom: 13 },
  brasov:    { lat: 45.6427, lng: 25.5887, zoom: 14 },
  timisoara: { lat: 45.7597, lng: 21.2300, zoom: 14 },
};

export interface Theme {
  id: string;
  title: string;
  tag: string;
  desc: string;
  palette: [string, string];
}

export const THEMES: Theme[] = [
  {
    id: 'firsts',
    title: 'A book of firsts',
    tag: 'Romantic · 6 stops',
    desc: 'Each stop revisits a "first" you shared — first coffee, first kiss, first fight.',
    palette: ['#c4623a', '#e8b75b'],
  },
  {
    id: 'cinema',
    title: 'City of cinema',
    tag: 'Cultural · 5 stops',
    desc: 'Trace TIFF venues and cult Romanian-cinema corners across Cluj.',
    palette: ['#3a4a2c', '#c4a865'],
  },
  {
    id: 'fairytale',
    title: 'Romanian fairytale',
    tag: 'Whimsical · 4 stops',
    desc: 'Hidden libraries, secret gardens and old bookbinders. Ends at a written wish.',
    palette: ['#7a5a3a', '#d8a868'],
  },
  {
    id: 'nocturne',
    title: 'Nocturne',
    tag: 'After dark · 5 stops',
    desc: 'A late-night crawl through speakeasies, jazz cellars and rooftop bars.',
    palette: ['#1f1a30', '#a06ac4'],
  },
  {
    id: 'sunrise',
    title: 'Sunrise to sundown',
    tag: 'A whole day · 7 stops',
    desc: 'From a hilltop sunrise to a Someș-side sunset, with breakfasts in between.',
    palette: ['#e89a45', '#3a6a9a'],
  },
  {
    id: 'custom',
    title: 'Start from scratch',
    tag: 'Blank slate',
    desc: 'No theme — pick every stop and write every word yourself.',
    palette: ['#9a9a9a', '#cccccc'],
  },
];

export interface SuggestedStop {
  id: string;
  // Real geographic coords (decimal degrees). Used by the Leaflet map on
  // Step 05 + by submit.ts when shaping the HuntConfig checkpoints.
  lat: number;
  lng: number;
  // Legacy viewBox coords. Kept optional for backwards compat with code
  // paths that haven't migrated; new stops only set lat/lng.
  x?: number;
  y?: number;
  name: string;
  hint?: string;
  type: string;
  time: string;
  chosen?: boolean;
  suggested?: boolean;
  order?: number;
  blurb: string;
  tag: string;
}

// Curated default route (real Cluj-Napoca coords). When the user skips the
// kickoff prompt, these populate Step 05 so the map isn't empty.
export const SUGGESTED_STOPS: SuggestedStop[] = [
  { id: 'klausenburg', lat: 46.7715, lng: 23.5905, name: 'Klausenburg Café',    hint: 'Where the date started', type: 'Café',      time: '15m', chosen: true, order: 1, blurb: 'A cup of black coffee, a window seat. Look for the cinnamon stars on the bar.', tag: 'Open · €€' },
  { id: 'carturesti',  lat: 46.7700, lng: 23.5963, name: 'Cărturești Bookshop', hint: 'Page 73',                type: 'Bookshop',  time: '20m', chosen: true, order: 2, blurb: 'A note hidden inside the favourite book. Aisle "P—R".', tag: 'Open · €' },
  { id: 'parcul',      lat: 46.7672, lng: 23.5798, name: 'Parcul Central',      hint: 'Under the third bench',  type: 'Park',      time: '10m', chosen: true, order: 3, blurb: 'East entrance, third bench in. A chalked X. Discreet.', tag: 'Free · 24h' },
  { id: 'insomnia',    lat: 46.7691, lng: 23.5897, name: 'Insomnia Café',       hint: 'Talk to Andrei',         type: 'Bar',       time: '25m', chosen: true, order: 4, blurb: "Ask the bartender for \"the long way home\". They'll know.", tag: 'Open · €€' },
  { id: 'cetatuia',    lat: 46.7747, lng: 23.5859, name: 'Cetățuia Lookout',    hint: 'Where we saw the city',  type: 'Viewpoint', time: '20m', chosen: true, order: 5, blurb: 'The northern wall, the bench facing the river. Sunset preferred.', tag: 'Free · day' },
  { id: 'form',        lat: 46.7681, lng: 23.6035, name: 'Form Space',           type: 'Bar',      time: '20m', suggested: true, blurb: 'A bold cocktail spot — could fit a sixth stop if you want more.', tag: 'Open · €€€' },
  { id: 'biserica',    lat: 46.7702, lng: 23.5897, name: 'Biserica Sf. Mihail',  type: 'Landmark', time: '15m', suggested: true, blurb: 'Gothic church — quiet at dusk, dramatic in photos.', tag: 'Free · day' },
  { id: 'piata-muz',   lat: 46.7723, lng: 23.5906, name: 'Piața Muzeului',       type: 'Square',   time: '10m', suggested: true, blurb: 'Pretty square, lots of cafés. Good photo stop.', tag: 'Open · 24h' },
  { id: 'botanic',     lat: 46.7634, lng: 23.5872, name: 'Grădina Botanică',     type: 'Garden',   time: '40m', suggested: true, blurb: 'Beautiful but big — only if your route has time.', tag: 'Open · €' },
  { id: 'janis',       lat: 46.7715, lng: 23.5955, name: 'Janis Pub',            type: 'Bar',      time: '25m', suggested: true, blurb: 'A loud, fun stop — a good "celebration" finale option.', tag: 'Open · €€' },
];

export interface DraftClue {
  type: string;
  text: string;
}

export const DRAFT_CLUES: Record<string, DraftClue> = {
  klausenburg: { type: 'Riddle',   text: 'Where the first cup was bitter and the first laugh was sweet, find the cinnamon star at the end of the street.' },
  carturesti:  { type: 'Photo',    text: 'Find the shelf where stories about runaways live. Aisle P—R. Slide your hand into page 73.' },
  parcul:      { type: 'Location', text: 'East gate, third bench, eyes closed. Count to ten. Now look down.' },
  insomnia:    { type: 'NPC',      text: "Ask Andrei behind the bar for \"the long way home.\" He'll hand you the next clue and a small espresso." },
  cetatuia:    { type: 'Final',    text: 'Climb until the city gets quiet. The bench facing the river is yours tonight. Look under the seat.' },
};

export interface HuntDraft {
  title: string;
  occasion: OccasionId;
  recipient: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  city: CityId;
  area: string;
  theme: string;
  stopCount: number;
  difficulty: 'sweet' | 'classic' | 'cruel';
  stops: SuggestedStop[];
  suggestions: SuggestedStop[];
  clues: Record<string, DraftClue>;
  reward: { kind: 'locker' | 'envelope' | 'person' | 'digital'; code: string; message: string };
  invitees: string[];
}

export function defaultDraft(): HuntDraft {
  return {
    title: 'lma m1halcea',
    occasion: 'birthday',
    recipient: 'Mihaela',
    date: '2026-06-14',
    timeStart: '10:00',
    timeEnd: '20:00',
    city: 'cluj',
    area: 'Centru istoric',
    theme: 'firsts',
    stopCount: 5,
    difficulty: 'sweet',
    stops: SUGGESTED_STOPS.filter((s) => s.chosen).map((s) => ({ ...s })),
    suggestions: SUGGESTED_STOPS.filter((s) => s.suggested),
    clues: { ...DRAFT_CLUES },
    reward: {
      kind: 'locker',
      code: '07-23-14',
      message: 'Happy birthday, my love. The locker is on the third floor. You earned this.',
    },
    invitees: ['mihaela@example.com'],
  };
}

// — Shared CSS helpers exposed as JS constants so each step doesn't repeat
// the same inline objects. Trove tokens are still the source of truth; these
// just give us per-component knobs the prototype set inline.
export const STYLE: { footerBar: CSSProperties } = {
  footerBar: {
    borderTop: '1px solid var(--line)',
    background: 'var(--paper)',
    padding: '14px 28px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
};
