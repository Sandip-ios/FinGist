export class RateLimitError extends Error {}
/** Temporary server-side problem (overloaded, 5xx, timeout): safe to retry later. */
export class TransientError extends Error {}

async function check(res: Response): Promise<void> {
  if (res.ok) return;
  const body = (await res.text()).slice(0, 300);
  if (res.status === 429) throw new RateLimitError(`Gemini rate limit: ${body}`);
  if (res.status >= 500) throw new TransientError(`Gemini HTTP ${res.status}: ${body}`);
  throw new Error(`Gemini HTTP ${res.status}: ${body}`);
}

function wrapAbort(e: unknown): never {
  if ((e as Error)?.name === 'AbortError') throw new TransientError('Gemini request timed out');
  throw e;
}

export interface GeminiConfig {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  /**
   * 'native' (default): Gemini generateContent with the x-goog-api-key header.
   * 'openai': Gemini's OpenAI-compatible endpoint with Authorization: Bearer
   * (useful where the key can only be injected as a Bearer token).
   */
  api?: 'native' | 'openai';
}

/** Calls Gemini with JSON output; returns the parsed JSON. */
export async function generateJson(cfg: GeminiConfig, system: string, user: string, schema: unknown): Promise<unknown> {
  if (cfg.api === 'openai') return generateJsonOpenAI(cfg, system, user, schema);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs ?? 60_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.2 },
      }),
    });
    await check(res);
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text) throw new Error(`Gemini returned no content (${data.promptFeedback?.blockReason ?? data.candidates?.[0]?.finishReason ?? 'unknown'})`);
    return JSON.parse(text);
  } catch (e) {
    wrapAbort(e);
  } finally {
    clearTimeout(timer);
  }
}

/** Converts the Gemini (OpenAPI-subset) schema to standard JSON Schema. */
export function toJsonSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toJsonSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const src = schema as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    if (k === 'nullable') continue;
    if (k === 'type' && typeof v === 'string') out.type = src.nullable ? [v.toLowerCase(), 'null'] : v.toLowerCase();
    else if (k === 'properties' && v && typeof v === 'object') {
      out.properties = Object.fromEntries(Object.entries(v).map(([pk, pv]) => [pk, toJsonSchema(pv)]));
    } else out[k] = toJsonSchema(v);
  }
  return out;
}

async function generateJsonOpenAI(cfg: GeminiConfig, system: string, user: string, schema: unknown): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs ?? 60_000);
  try {
    // Structured output must be an object at the top level, so the array is wrapped.
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `${user}\n\nReturn {"items": [...]} with one object per story.` },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'cards',
            schema: { type: 'object', properties: { items: toJsonSchema(schema) }, required: ['items'] },
          },
        },
      }),
    });
    await check(res);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content ?? '';
    if (!text) throw new Error('Gemini returned no content');
    const parsed = JSON.parse(text) as { items?: unknown } | unknown[];
    return Array.isArray(parsed) ? parsed : (parsed as { items?: unknown }).items;
  } catch (e) {
    wrapAbort(e);
  } finally {
    clearTimeout(timer);
  }
}
