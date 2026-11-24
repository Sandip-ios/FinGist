export class RateLimitError extends Error {}

export interface GeminiConfig {
  apiKey: string;
  model: string;
  timeoutMs?: number;
}

/** Calls Gemini generateContent with JSON output; returns the parsed JSON. */
export async function generateJson(cfg: GeminiConfig, system: string, user: string, schema: unknown): Promise<unknown> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs ?? 45_000);
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
    if (res.status === 429) throw new RateLimitError(`Gemini rate limit: ${(await res.text()).slice(0, 200)}`);
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text) throw new Error(`Gemini returned no content (${data.promptFeedback?.blockReason ?? data.candidates?.[0]?.finishReason ?? 'unknown'})`);
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}
