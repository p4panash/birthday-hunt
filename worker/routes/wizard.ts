// /api/admin/wizard/draft — turn a free-form prompt into a structured draft.
//
// Uses Claude's native tool-use API:
//   1. We define a `draft_hunt` tool whose input_schema is the exact shape
//      we want back. Forcing tool_choice means Claude can't drift off-format.
//   2. We stream the tool-call's `input_json_delta` events to the client over
//      SSE. As each line value finishes being written, we emit a `line` event
//      so the UI can reveal it the instant the model finishes it — same feel
//      as the original prototype, but driven by real tokens.
//   3. Once the stream ends, we send a `done` event with the full validated
//      patch.
//
// Falls back to 503 if ANTHROPIC_API_KEY is unset so the SPA can use its
// canned local sample.

import Anthropic from '@anthropic-ai/sdk';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireAdmin } from '../middleware/access';
import type { Env } from '../index';

const wizard = new Hono<{ Bindings: Env }>();

wizard.use('*', requireAdmin);

const RequestSchema = z.object({
  prompt: z.string().min(8).max(2000),
});

// Final shape we validate the assembled tool input against. The streaming
// path emits incremental `line` events as Claude writes them, then we parse
// the whole thing once at the end to extract `patch`.
const DraftLine = z.object({
  id: z.enum(['occasion', 'city', 'theme', 'shape', 'stops', 'reward']),
  label: z.string(),
  value: z.string(),
});

const DraftResponse = z.object({
  lines: z.array(DraftLine).length(6),
  patch: z.object({
    title: z.string().optional(),
    recipient: z.string().optional(),
    occasion: z
      .enum([
        'birthday',
        'anniversary',
        'proposal',
        'bachelor',
        'team',
        'tourist',
        'kids',
        'just-because',
      ])
      .optional()
      .catch(undefined),
    city: z
      .enum(['cluj', 'buc', 'brasov', 'timisoara'])
      .optional()
      .catch(undefined),
    area: z.string().optional(),
    theme: z
      .enum(['firsts', 'cinema', 'fairytale', 'nocturne', 'sunrise', 'custom'])
      .optional()
      .catch(undefined),
    stopCount: z.number().int().min(3).max(12).optional().catch(undefined),
    difficulty: z.enum(['sweet', 'classic', 'cruel']).optional().catch(undefined),
  }),
});

// Anthropic tool definition — JSON Schema matching DraftResponse above.
// Claude's tool_use enforces this shape, so we never need to JSON.parse a
// stringly-typed response from a text block.
const DRAFT_TOOL: Anthropic.Tool = {
  name: 'draft_hunt',
  description:
    'Return a structured 6-line preview + patch for a hunt brief. ' +
    'The lines drive a streaming UI; the patch is merged into the working draft.',
  input_schema: {
    type: 'object',
    properties: {
      lines: {
        type: 'array',
        minItems: 6,
        maxItems: 6,
        description:
          'Exactly 6 entries in this fixed order: occasion, city, theme, shape, stops, reward.',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              enum: ['occasion', 'city', 'theme', 'shape', 'stops', 'reward'],
            },
            label: { type: 'string' },
            value: {
              type: 'string',
              description: 'Under 80 characters, no markdown.',
            },
          },
          required: ['id', 'label', 'value'],
        },
      },
      patch: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short lowercase slug.' },
          recipient: {
            type: 'string',
            description: 'First name OR group name like "the boyz".',
          },
          occasion: {
            type: 'string',
            enum: [
              'birthday',
              'anniversary',
              'proposal',
              'bachelor',
              'team',
              'tourist',
              'kids',
              'just-because',
            ],
            description:
              'team covers "boys night", "girls weekend", "the squad", "the boyz", "my crew", team-building. just-because is the catch-all of last resort.',
          },
          city: {
            type: 'string',
            enum: ['cluj', 'buc', 'brasov', 'timisoara'],
            description: 'Omit if the prompt names a city outside this list.',
          },
          area: { type: 'string' },
          theme: {
            type: 'string',
            enum: ['firsts', 'cinema', 'fairytale', 'nocturne', 'sunrise', 'custom'],
          },
          stopCount: { type: 'integer', minimum: 3, maximum: 12 },
          difficulty: { type: 'string', enum: ['sweet', 'classic', 'cruel'] },
        },
      },
    },
    required: ['lines', 'patch'],
  },
};

const SYSTEM_PROMPT = `You are a treasure-hunt designer. The user gives a one-paragraph brief; call
the draft_hunt tool to return a structured draft.

Rules for each line value:
- "occasion" line: one short sentence describing the vibe.
- "city" line: city + neighbourhood.
- "theme" line: theme name + tone descriptor.
- "shape" line: difficulty + duration.
- "stops" line: stop1 → stop2 → ... → final (5 names).
- "reward" line: reward shape + tone.
Each line value MUST be under 80 characters.

Patch fields are typed by the tool schema. Prefer a specific occasion over
just-because whenever any group/relationship/age signal exists.
Defaults when the user doesn't say: area="Centru istoric", theme=firsts,
stopCount=5, difficulty=sweet.

Worked examples:

prompt: "Boys' night mystery hunt for my crew in Cluj"
→ patch.occasion: "team", patch.recipient: "the boyz", patch.city: "cluj"

prompt: "30th birthday for Andra in Brașov"
→ patch.occasion: "birthday", patch.recipient: "Andra", patch.city: "brasov"

prompt: "Bachelorette for Maria in București, after dark"
→ patch.occasion: "bachelor", patch.theme: "nocturne", patch.city: "buc"

prompt: "Walking tour for two visiting friends from Spain"
→ patch.occasion: "tourist", patch.recipient: "the visitors"`;

// Pull out a label→value pair from the in-flight tool-input JSON. As Claude
// streams, the partial string looks like:
//   {"lines":[{"id":"occasion","label":"Occasion","value":"Mystery quest"...
// Once a line's closing quote on `value` lands AND we haven't seen its id
// before, we can emit it.
function extractCompletedLines(
  partial: string,
  alreadyEmitted: Set<string>,
): { id: string; label: string; value: string }[] {
  const re =
    /"id"\s*:\s*"([^"]+)"\s*,\s*"label"\s*:\s*"([^"]+)"\s*,\s*"value"\s*:\s*"([^"]+)"/g;
  const out: { id: string; label: string; value: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(partial)) != null) {
    const id = m[1];
    if (alreadyEmitted.has(id)) continue;
    alreadyEmitted.add(id);
    out.push({ id, label: m[2], value: m[3] });
  }
  return out;
}

function sseEvent(event: string, data: unknown): Uint8Array {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  return new TextEncoder().encode(payload);
}

wizard.post('/draft', async (c) => {
  const key = c.env.ANTHROPIC_API_KEY;
  if (!key) {
    return c.json(
      {
        error: {
          code: 'ai_unconfigured',
          message: 'ANTHROPIC_API_KEY not set on the worker',
        },
      },
      503,
    );
  }

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await c.req.json());
  } catch (e) {
    return c.json(
      { error: { code: 'invalid_input', message: (e as Error).message } },
      400,
    );
  }

  const client = new Anthropic({ apiKey: key });

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  // Spawn the producer. We DON'T await it — we return the readable side
  // immediately so the client can start reading.
  c.executionCtx.waitUntil(
    (async () => {
      const emitted = new Set<string>();
      let partial = '';
      try {
        const stream = await client.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          tools: [DRAFT_TOOL],
          tool_choice: { type: 'tool', name: 'draft_hunt' },
          messages: [{ role: 'user', content: body.prompt }],
        });

        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'input_json_delta'
          ) {
            partial += event.delta.partial_json;
            for (const line of extractCompletedLines(partial, emitted)) {
              await writer.write(sseEvent('line', line));
            }
          }
        }

        const finalMessage = await stream.finalMessage();
        const toolUse = finalMessage.content.find((b) => b.type === 'tool_use');
        if (!toolUse || toolUse.type !== 'tool_use') {
          await writer.write(
            sseEvent('error', {
              code: 'no_tool_use',
              message: 'model did not call the tool',
            }),
          );
          return;
        }
        const parsed = DraftResponse.safeParse(toolUse.input);
        if (!parsed.success) {
          await writer.write(
            sseEvent('error', {
              code: 'ai_malformed',
              message: parsed.error.issues
                .map((i) => `${i.path.join('.')}: ${i.message}`)
                .join('; '),
            }),
          );
          return;
        }
        // Re-emit any lines the regex missed (e.g. arrival in a single chunk
        // after the loop's last scan) before signalling done.
        for (const ln of parsed.data.lines) {
          if (!emitted.has(ln.id)) {
            emitted.add(ln.id);
            await writer.write(sseEvent('line', ln));
          }
        }
        await writer.write(sseEvent('done', { patch: parsed.data.patch }));
      } catch (err) {
        await writer.write(
          sseEvent('error', {
            code: 'ai_upstream',
            message: (err as Error).message,
          }),
        );
      } finally {
        await writer.close();
      }
    })(),
  );

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
});

export { wizard as wizardRoutes };
