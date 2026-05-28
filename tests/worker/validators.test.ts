// Tests for worker/lib/validators.ts. Each schema gets at least one positive
// case (parse succeeds) and one negative case (parse throws ZodError on a
// specific bad field).

import { describe, expect, it } from 'vitest';
import {
  CreateHuntRequestSchema,
  CreateTeamRequestSchema,
  JoinTeamRequestSchema,
  PatchHuntRequestSchema,
} from '../../worker/lib/validators';
import type { HuntConfig } from '../../shared/config/types';

const validConfig: HuntConfig = {
  friendName: 'mihali',
  intro: { eyebrow: 'a', headline: 'b', body: 'c', cta: 'd', finePrint: 'e' },
  gpsPreface: { headline: 'a', body: 'b', allowCta: 'c' },
  deadlineISO: '2026-05-28T01:10:00+03:00',
  countdown: { eyebrow: 'a' },
  checkpoints: [
    {
      id: 1, name: 'one', teaser: 't', realHint: 'h',
      lat: 44.4, lng: 26.1, radiusMeters: 25, code: 'A',
      successCopy: 's',
    },
    {
      id: 2, name: 'two', teaser: 't', realHint: 'h',
      lat: 44.42, lng: 26.12, radiusMeters: 25, code: 'B',
      successCopy: 's',
    },
    {
      id: 3, name: 'three', teaser: 't', realHint: 'h',
      lat: 44.43, lng: 26.13, radiusMeters: 25, code: 'C',
      successCopy: 's',
    },
  ],
  warmthStatuses: { veryFar: '', far: '', close: '', onTop: '' },
  stuckSheet: {
    title: '', realHintIntro: '', codeLabel: '', codePlaceholder: '',
    unlockCta: '', closeCta: '',
  },
  reveal: { headline: '', nextCta: '', finaleCta: '' },
  finale: {
    headline: '', subheadline: '', lockerHintLabel: '',
    instruction: '', qrBrightnessTip: '', openLockerMapLabel: '',
  },
  easyboxLocation: {
    name: 'box', hint: 'h',
    mapsUrl: 'https://maps.example.com/x',
  },
  errors: { wrongCode: '', gpsDenied: '', gpsFlaky: '' },
  photos: [],
  sound: { unlockSrc: 'u.ogg', finaleSrc: 'f.ogg' },
};

describe('CreateHuntRequestSchema', () => {
  const valid = {
    name: 'mihali-bday-2026',
    friend_name: 'mihali',
    deadline_iso: '2026-05-28T01:10:00+03:00',
    config: validConfig,
  };

  it('accepts a complete valid request', () => {
    expect(() => CreateHuntRequestSchema.parse(valid)).not.toThrow();
  });

  it('rejects empty name', () => {
    expect(() => CreateHuntRequestSchema.parse({ ...valid, name: '' })).toThrow();
  });

  it('rejects missing config', () => {
    const { config: _omit, ...rest } = valid;
    void _omit;
    expect(() => CreateHuntRequestSchema.parse(rest)).toThrow();
  });

  it('rejects invalid config (bad checkpoint count)', () => {
    const badConfig = {
      ...validConfig,
      checkpoints: [validConfig.checkpoints[0]],
    };
    expect(() =>
      CreateHuntRequestSchema.parse({ ...valid, config: badConfig }),
    ).toThrow();
  });
});

describe('PatchHuntRequestSchema', () => {
  it('accepts a partial update with one field', () => {
    expect(() =>
      PatchHuntRequestSchema.parse({ deadline_iso: '2030-01-01T00:00:00Z' }),
    ).not.toThrow();
  });

  it('accepts empty body', () => {
    expect(() => PatchHuntRequestSchema.parse({})).not.toThrow();
  });

  it('rejects empty name when present', () => {
    expect(() => PatchHuntRequestSchema.parse({ name: '' })).toThrow();
  });

  it('rejects invalid config when present', () => {
    expect(() =>
      PatchHuntRequestSchema.parse({ config: { friendName: 'x' } }),
    ).toThrow();
  });
});

describe('CreateTeamRequestSchema', () => {
  it('accepts a valid name', () => {
    expect(() => CreateTeamRequestSchema.parse({ name: 'team-coral' })).not.toThrow();
  });

  it('rejects empty name', () => {
    expect(() => CreateTeamRequestSchema.parse({ name: '' })).toThrow();
  });

  it('rejects name over 100 chars', () => {
    expect(() =>
      CreateTeamRequestSchema.parse({ name: 'x'.repeat(101) }),
    ).toThrow();
  });
});

describe('JoinTeamRequestSchema', () => {
  const valid = {
    invite_code: 'ABCD1234',
    player_name: 'andi',
    client_id: 'browser-' + 'a'.repeat(16),
  };

  it('accepts a valid join request', () => {
    expect(() => JoinTeamRequestSchema.parse(valid)).not.toThrow();
  });

  it('rejects lowercase invite_code', () => {
    expect(() =>
      JoinTeamRequestSchema.parse({ ...valid, invite_code: 'abcd1234' }),
    ).toThrow();
  });

  it('rejects invite_code with forbidden letters', () => {
    expect(() =>
      JoinTeamRequestSchema.parse({ ...valid, invite_code: 'IBCD1234' }),
    ).toThrow();
  });

  it('rejects empty player_name', () => {
    expect(() =>
      JoinTeamRequestSchema.parse({ ...valid, player_name: '' }),
    ).toThrow();
  });

  it('rejects too-short client_id', () => {
    expect(() =>
      JoinTeamRequestSchema.parse({ ...valid, client_id: 'short' }),
    ).toThrow();
  });
});
