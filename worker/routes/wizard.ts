// /api/admin/wizard/draft — turn a free-form prompt into a structured draft.
//
// Calls Claude (Anthropic SDK) with a JSON-schema-shaped prompt. Returns
// six rendered "lines" (the streaming preview the kickoff screen shows) plus
// a `patch` object the frontend merges into the in-memory HuntDraft.
//
// Falls back to a 503 if ANTHROPIC_API_KEY isn't configured so the SPA can
// surface the local canned draft instead of erroring out.

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

// What Claude must return. Six fixed labels mirror the streaming preview;
// the patch is merged into the existing HuntDraft on the client.
const DraftLine = z.object({
  id: z.enum(['occasion', 'city', 'theme', 'shape', 'stops', 'reward']),
  label: z.string(),
  value: z.string(),
});

// Enum fields use `.catch(undefined)` so a Claude response with a city the
// frontend doesn't know about (e.g. "baia-mare") doesn't sink the whole draft.
// The frontend merges patch into the working draft; undefined fields are
// skipped, so the user keeps the defaults for those axes.
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
    theme: z.string().optional().catch(undefined),
    stopCount: z.number().int().min(3).max(12).optional().catch(undefined),
    difficulty: z.enum(['sweet', 'classic', 'cruel']).optional().catch(undefined),
  }),
});

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

  const systemPrompt = `You are a treasure-hunt designer. The user gives a one-paragraph brief; you
return a six-field structured draft of the hunt. Always answer in strict JSON
matching the schema described below — no prose, no markdown fences.

Schema:
{
  "lines": [
    { "id": "occasion", "label": "Occasion",        "value": "<one short sentence>" },
    { "id": "city",     "label": "City",            "value": "<city + neighbourhood>" },
    { "id": "theme",    "label": "Theme",           "value": "<theme name + descriptor>" },
    { "id": "shape",    "label": "Pace",            "value": "<difficulty + duration>" },
    { "id": "stops",    "label": "Suggested stops", "value": "<stop1 → stop2 → ... → final>" },
    { "id": "reward",   "label": "Finale",          "value": "<reward shape + tone>" }
  ],
  "patch": {
    "title":      "<short slug, lowercase, e.g. 'andra-bday-2026' or 'lma m1halcea'>",
    "recipient":  "<first name OR group name like 'the boyz', 'the squad'>",
    "occasion":   pick the BEST fit from this list:
                  - birthday:    any birthday celebration
                  - anniversary: wedding or relationship anniversary
                  - proposal:    marriage proposal
                  - bachelor:    bachelor / bachelorette / hen / stag party
                  - team:        group adventure for friends, colleagues, "boys' night",
                                 "girls' weekend", "the boyz", "the squad", "my crew",
                                 team-building, group quests with no romantic angle
                  - tourist:     city sightseeing for visitors with no group hook
                  - kids:        children's party
                  - just-because: ONLY when none of the above clearly applies
                  Prefer a specific category over just-because whenever any signal exists.
  "city":       one of: cluj, buc, brasov, timisoara (best guess from the prompt;
                if the city named isn't one of these, omit this field),
  "area":       "<neighbourhood string, e.g. 'Centru istoric'>",
  "theme":      one of: firsts, cinema, fairytale, nocturne, sunrise, custom,
  "stopCount":  integer 3..12,
  "difficulty": one of: sweet, classic, cruel
  }
}

Defaults when the user doesn't say: area="Centru istoric", theme=firsts,
stopCount=5, difficulty=sweet. Keep "value" strings under 80 characters each.

Worked examples:

prompt: "Boys' night mystery hunt for my crew in Cluj"
→ patch.occasion: "team", patch.recipient: "the boyz"

prompt: "30th birthday for Andra in Brașov"
→ patch.occasion: "birthday", patch.recipient: "Andra", patch.city: "brasov"

prompt: "Bachelorette for Maria in București, after dark"
→ patch.occasion: "bachelor", patch.theme: "nocturne", patch.city: "buc"

prompt: "Walking tour for two visiting friends from Spain"
→ patch.occasion: "tourist", patch.recipient: "the visitors"

prompt: "Just want something fun for me and my sister"
→ patch.occasion: "just-because" (only because nothing else fits)`;

  let aiResponse;
  try {
    aiResponse = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: body.prompt }],
    });
  } catch (e) {
    return c.json(
      {
        error: {
          code: 'ai_upstream',
          message: (e as Error).message,
        },
      },
      502,
    );
  }

  // Claude returns content as an array of blocks; we expect a single text block.
  const textBlock = aiResponse.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    return c.json(
      { error: { code: 'ai_empty', message: 'no text block in response' } },
      502,
    );
  }

  // Strip optional markdown fence and parse JSON.
  const raw = textBlock.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  let parsed;
  try {
    const obj = JSON.parse(raw);
    parsed = DraftResponse.parse(obj);
  } catch (e) {
    return c.json(
      {
        error: {
          code: 'ai_malformed',
          message: 'response did not match schema: ' + (e as Error).message,
          raw,
        },
      },
      502,
    );
  }

  return c.json(parsed);
});

export { wizard as wizardRoutes };
