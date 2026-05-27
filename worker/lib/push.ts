// Minimal VAPID + payload encryption for Web Push on Cloudflare Workers.
//
// Uses only the Web Crypto API (`crypto.subtle`) — no Node shims needed.
// Implements:
//   - VAPID JWT signing (ES256 over P-256)
//   - aes128gcm payload encryption per RFC 8291 (the only mode modern push
//     services accept)
//
// Why hand-rolled: existing libraries (`web-push`) require Node `crypto`;
// `@negrel/webpush` isn't published; @magicbell/webpush is heavyweight and
// vendor-coupled. The full encryption flow is ~80 lines and tests cleanly.
//
// Two env vars are required (set as wrangler secrets):
//   - VAPID_PUBLIC_KEY  — base64url-encoded uncompressed P-256 public key (65 bytes)
//   - VAPID_PRIVATE_KEY — base64url-encoded P-256 private key (32 bytes)
//   - VAPID_CONTACT     — `mailto:you@example.com`
// Generate locally with `npx web-push generate-vapid-keys`.

export interface PushSubscriptionShape {
  endpoint: string;
  p256dh: string; // base64url
  auth: string; // base64url
}

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

export interface PushEnv {
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_CONTACT: string;
}

export interface SendResult {
  ok: boolean;
  status: number;
  /** When status is 404/410: the push service has unregistered the
   *  subscription. The caller should delete it from D1. */
  gone: boolean;
}

export async function sendPush(
  sub: PushSubscriptionShape,
  payload: PushPayload,
  env: PushEnv,
): Promise<SendResult> {
  const audience = new URL(sub.endpoint).origin;
  const jwt = await signVapidJwt(audience, env);

  const body = JSON.stringify(payload);
  const encrypted = await encryptPayload(body, sub.p256dh, sub.auth);

  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: '60', // 60s — chat is ephemeral; older notifications drop
      Urgency: 'normal',
      Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
    },
    body: encrypted,
  });

  return {
    ok: res.ok,
    status: res.status,
    gone: res.status === 404 || res.status === 410,
  };
}

// ── VAPID JWT ─────────────────────────────────────────────────────

async function signVapidJwt(audience: string, env: PushEnv): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12h — push services cap at 24h
    sub: env.VAPID_CONTACT,
  };
  const signingInput = `${b64uJSON(header)}.${b64uJSON(claims)}`;

  const key = await importVapidPrivateKey(env.VAPID_PRIVATE_KEY);
  const sigBuf = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  );
  // Web Crypto returns raw r||s for ECDSA — that's exactly what JOSE wants.
  return `${signingInput}.${b64uBytes(new Uint8Array(sigBuf))}`;
}

async function importVapidPrivateKey(b64u: string): Promise<CryptoKey> {
  const d = b64uDecode(b64u);
  // Construct a JWK; provide both d and the public key components derived
  // from VAPID_PUBLIC_KEY via the caller. crypto.subtle.importKey for ECDSA
  // P-256 from raw private bytes requires JWK or pkcs8 — we use JWK without
  // x/y, then let importKey deriveBits later. Cleaner: derive x/y from d
  // via ECC… but that needs custom math. Use pkcs8 instead.
  //
  // Simplest path: ship the private key as a 32-byte raw, wrap into pkcs8.
  const pkcs8 = rawP256ToPkcs8(d);
  return crypto.subtle.importKey(
    'pkcs8',
    pkcs8,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

// Minimal PKCS#8 wrapper for a raw 32-byte P-256 private scalar. Fixed DER
// prefix; only the scalar varies.
function rawP256ToPkcs8(d: Uint8Array): ArrayBuffer {
  // Length-prefixed DER for ECPrivateKey inside PKCS8. Header bytes derived
  // from RFC 5208 / 5915 for P-256. The 32-byte private key sits at offset
  // PREFIX.length below.
  const PREFIX = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86,
    0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  // 32-byte raw private key
  if (d.length !== 32) {
    throw new Error(`VAPID_PRIVATE_KEY must be 32 bytes, got ${d.length}`);
  }
  // Suffix: optional public-key BIT STRING absent → empty trailer
  const SUFFIX = new Uint8Array([0xa0, 0x07, 0x06, 0x05, 0x2b, 0x81, 0x04, 0x00, 0x22]);
  const out = new Uint8Array(PREFIX.length + d.length + SUFFIX.length);
  out.set(PREFIX, 0);
  out.set(d, PREFIX.length);
  out.set(SUFFIX, PREFIX.length + d.length);
  // Copy into a fresh ArrayBuffer to satisfy the strict ArrayBuffer-only
  // signature of importKey() in Workers' type defs.
  return out.buffer.slice(0) as ArrayBuffer;
}

// ── Payload encryption (RFC 8291 aes128gcm) ───────────────────────

async function encryptPayload(
  plaintext: string,
  recipientP256dhB64u: string,
  recipientAuthB64u: string,
): Promise<ArrayBuffer> {
  const recipientPub = b64uDecode(recipientP256dhB64u); // 65 bytes uncompressed
  const recipientAuth = b64uDecode(recipientAuthB64u); // 16 bytes

  // 1. Ephemeral ECDH keypair
  const ephemeral = (await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )) as CryptoKeyPair;
  const ephemeralRaw = new Uint8Array(
    (await crypto.subtle.exportKey('raw', ephemeral.publicKey)) as ArrayBuffer,
  ); // 65 bytes

  // 2. Import recipient public for ECDH derive
  const recipientKey = await crypto.subtle.importKey(
    'raw',
    recipientPub.buffer.slice(0) as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  // The DOM lib's SubtleCrypto.deriveBits type expects `public:` but the
  // Workers types use a slightly different shape; the runtime accepts the
  // standard W3C field name. Cast to bypass the typings disagreement.
  const shared = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: recipientKey } as unknown as { name: 'ECDH' },
    ephemeral.privateKey,
    256,
  );

  // 3. HKDF(salt=auth, ikm=shared, info="WebPush: info\0" + recipientPub + ephemeralPub) → IKM2 (32 bytes)
  const sharedBytes = new Uint8Array(shared);
  const info1 = concat(
    new TextEncoder().encode('WebPush: info\0'),
    recipientPub,
    ephemeralRaw,
  );
  const ikm2 = await hkdf(recipientAuth, sharedBytes, info1, 32);

  // 4. Generate salt (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 5. HKDF(salt=salt, ikm=ikm2, info="Content-Encoding: aes128gcm\0", L=16) → CEK
  const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');
  const cek = await hkdf(salt, ikm2, cekInfo, 16);

  // 6. HKDF(salt=salt, ikm=ikm2, info="Content-Encoding: nonce\0", L=12) → nonce
  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');
  const nonce = await hkdf(salt, ikm2, nonceInfo, 12);

  // 7. Padding-then-plaintext per RFC 8291 §3.1: plaintext || 0x02 || 0x00...
  const ptBytes = new TextEncoder().encode(plaintext);
  const padded = new Uint8Array(ptBytes.length + 1);
  padded.set(ptBytes, 0);
  padded[ptBytes.length] = 0x02; // record terminator (RFC 8188 single-record)

  // 8. AES-128-GCM encrypt
  const cekKey = await crypto.subtle.importKey(
    'raw',
    cek,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      cekKey,
      padded,
    ),
  );

  // 9. Build aes128gcm header: salt(16) || rs(4, BE, 4096) || idlen(1=65) || keyid(=ephemeral pub, 65)
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  // rs = 4096 (record size)
  header[16] = 0;
  header[17] = 0;
  header[18] = 0x10;
  header[19] = 0x00;
  header[20] = 65; // idlen
  header.set(ephemeralRaw, 21);

  return concat(header, ciphertext).buffer.slice(0) as ArrayBuffer;
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const ikmKey = await crypto.subtle.importKey(
    'raw',
    ikm,
    'HKDF',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    ikmKey,
    length * 8,
  );
  return new Uint8Array(bits);
}

// ── base64url helpers ─────────────────────────────────────────────

function b64uJSON(obj: unknown): string {
  return b64uBytes(new TextEncoder().encode(JSON.stringify(obj)));
}

function b64uBytes(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64uDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}
