// Unit tests for worker/lib/invite.ts.

import { describe, expect, it } from 'vitest';
import {
  generateInviteCode,
  isValidInviteCode,
} from '../../worker/lib/invite';

const VALID = /^[0-9A-HJKMNP-TV-Z]{8}$/;
const FORBIDDEN_LETTERS = ['I', 'L', 'O', 'U'];

describe('generateInviteCode', () => {
  it('returns 8 Crockford characters', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateInviteCode();
      expect(code).toMatch(VALID);
    }
  });

  it('never contains forbidden letters', () => {
    for (let i = 0; i < 1000; i++) {
      const code = generateInviteCode();
      for (const ch of FORBIDDEN_LETTERS) {
        expect(code).not.toContain(ch);
      }
    }
  });

  it('produces no duplicates across 10k generations', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      seen.add(generateInviteCode());
    }
    expect(seen.size).toBe(10_000);
  });

  it('uses the full alphabet over many samples', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5_000; i++) {
      for (const ch of generateInviteCode()) seen.add(ch);
    }
    // Should cover all 32 Crockford chars
    expect(seen.size).toBe(32);
  });
});

describe('isValidInviteCode', () => {
  it('accepts a freshly generated code', () => {
    expect(isValidInviteCode(generateInviteCode())).toBe(true);
  });

  it('accepts a known-good literal', () => {
    expect(isValidInviteCode('ABCD1234')).toBe(true);
  });

  it('rejects forbidden letters', () => {
    expect(isValidInviteCode('IBCD1234')).toBe(false);
    expect(isValidInviteCode('LBCD1234')).toBe(false);
    expect(isValidInviteCode('OBCD1234')).toBe(false);
    expect(isValidInviteCode('UBCD1234')).toBe(false);
  });

  it('rejects lowercase', () => {
    expect(isValidInviteCode('abcd1234')).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(isValidInviteCode('ABCD123')).toBe(false);    // 7
    expect(isValidInviteCode('ABCD12345')).toBe(false);  // 9
    expect(isValidInviteCode('')).toBe(false);
  });

  it('rejects non-alphanumeric', () => {
    expect(isValidInviteCode('ABCD-234')).toBe(false);
    expect(isValidInviteCode('ABCD 234')).toBe(false);
  });
});
