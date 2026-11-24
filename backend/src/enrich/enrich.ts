import type { Enrichment, Story } from '../types';
import { generateJson, type GeminiConfig } from './gemini';
import { buildUserPrompt, RESPONSE_SCHEMA, SYSTEM_PROMPT } from './prompt';
import { validateEnrichment } from './validate';

export interface EnrichOutcome {
  story: Story;
  enrichment?: Enrichment;
  error?: string;
}

/** Enriches a batch of stories in ONE model call (saves free-tier daily quota). */
export async function enrichBatch(cfg: GeminiConfig, stories: Story[]): Promise<EnrichOutcome[]> {
  if (stories.length === 0) return [];
  const result = await generateJson(cfg, SYSTEM_PROMPT, buildUserPrompt(stories), RESPONSE_SCHEMA);
  const rows = Array.isArray(result) ? (result as Record<string, unknown>[]) : [];
  const byId = new Map(rows.filter((r) => r && typeof r.id === 'string').map((r) => [r.id as string, r]));
  return stories.map((story) => {
    const raw = byId.get(story.id);
    if (!raw) return { story, error: 'missing from model output' };
    return { story, enrichment: validateEnrichment(story, raw) };
  });
}
