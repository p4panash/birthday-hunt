// Short URL-safe IDs for hunts/teams/players. Not security-sensitive — the
// invite_code carries the secret. Size 12 of 36-char alphabet ≈ 60 bits.

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export function nanoid(size = 12): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}
