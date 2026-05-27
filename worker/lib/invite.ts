// Invite codes are 8-char Crockford base32 strings: 0-9, A-H, J-K, M-N, P-T,
// V-Z. Omitted letters (I, L, O, U) avoid visual collisions with 1/0 and with
// V. Eight chars = 40 bits = ~1.1 trillion codes; collisions per hunt are
// negligible at <10k teams. Callers handle DB-level uniqueness via the UNIQUE
// constraint on teams.invite_code.

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const INVITE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{8}$/;

export function generateInviteCode(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);

  let bits = 0n;
  for (const b of bytes) bits = (bits << 8n) | BigInt(b);

  let out = '';
  for (let i = 0; i < 8; i++) {
    const idx = Number((bits >> BigInt(35 - i * 5)) & 31n);
    out += CROCKFORD[idx];
  }
  return out;
}

export function isValidInviteCode(s: string): boolean {
  return INVITE_PATTERN.test(s);
}
