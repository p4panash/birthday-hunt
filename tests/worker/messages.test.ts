// Schema round-trip tests for shared/messages.ts envelopes.
// Validates Zod schemas accept valid shapes and reject invalid ones.

import { describe, expect, it } from 'vitest';
import {
  ClientMsgSchema,
  ServerMsgSchema,
  REACTION_EMOJIS,
} from '../../shared/messages';

describe('ClientMsg variants', () => {
  it('parses chat_send with body', () => {
    const msg = { v: 1, type: 'chat_send', body: 'hello team' };
    expect(ClientMsgSchema.parse(msg)).toEqual(msg);
  });

  it('parses react_send with valid emoji', () => {
    for (const emoji of REACTION_EMOJIS) {
      const msg = { v: 1, type: 'react_send', emoji };
      expect(ClientMsgSchema.parse(msg)).toEqual(msg);
    }
  });

  it('rejects react_send with non-allowlisted emoji', () => {
    expect(() =>
      ClientMsgSchema.parse({ v: 1, type: 'react_send', emoji: '💩' }),
    ).toThrow();
  });

  it('parses ping_send with coords', () => {
    const msg = { v: 1, type: 'ping_send', lat: 44.4, lng: 26.1 };
    expect(ClientMsgSchema.parse(msg)).toEqual(msg);
  });

  it('rejects ping_send with missing coords', () => {
    expect(() =>
      ClientMsgSchema.parse({ v: 1, type: 'ping_send', lat: 44.4 }),
    ).toThrow();
  });
});

describe('ServerMsg variants', () => {
  it('parses chat_snapshot with messages', () => {
    const msg = {
      v: 1,
      type: 'chat_snapshot',
      messages: [
        {
          id: 1,
          player_id: 'p1',
          player_name: 'andi',
          body: 'hi',
          created_at: 1716800000000,
        },
      ],
    };
    expect(ServerMsgSchema.parse(msg)).toEqual(msg);
  });

  it('parses chat_new with single message', () => {
    const msg = {
      v: 1,
      type: 'chat_new',
      message: {
        id: 2,
        player_id: 'p2',
        player_name: 'maria',
        body: 'hello',
        created_at: 1716800001000,
      },
    };
    expect(ServerMsgSchema.parse(msg)).toEqual(msg);
  });

  it('parses chat_wiped (no payload)', () => {
    const msg = { v: 1, type: 'chat_wiped' };
    expect(ServerMsgSchema.parse(msg)).toEqual(msg);
  });

  it('parses react_show with sender info', () => {
    const msg = {
      v: 1,
      type: 'react_show',
      emoji: '🎉',
      sender_id: 'p1',
      sender_name: 'andi',
      id: 'r1',
    };
    expect(ServerMsgSchema.parse(msg)).toEqual(msg);
  });

  it('parses ping_show with expires_at', () => {
    const msg = {
      v: 1,
      type: 'ping_show',
      lat: 44.4,
      lng: 26.1,
      sender_id: 'p1',
      sender_name: 'andi',
      id: 'pg1',
      expires_at: 1716800005000,
    };
    expect(ServerMsgSchema.parse(msg)).toEqual(msg);
  });

  it('parses error with optional retry_after_ms', () => {
    const minimal = {
      v: 1,
      type: 'error',
      code: 'rate_limited',
      message: 'slow down',
    };
    expect(ServerMsgSchema.parse(minimal)).toEqual(minimal);

    const withRetry = { ...minimal, retry_after_ms: 1000 };
    expect(ServerMsgSchema.parse(withRetry)).toEqual(withRetry);
  });
});

describe('Wrong protocol version is rejected', () => {
  it('rejects v=2', () => {
    expect(() =>
      ClientMsgSchema.parse({ v: 2, type: 'chat_send', body: 'x' }),
    ).toThrow();
  });
});
