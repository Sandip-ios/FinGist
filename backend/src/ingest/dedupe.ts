/**
 * Near-duplicate headline detection. Different outlets report the same event
 * with different wording; Jaccard similarity over meaningful word sets catches
 * most of those while keeping genuinely different stories apart.
 */
const STOP = new Set(
  ('a an the and or of in on at to for from by with as is are was were be been its it this that these those after before over under ' +
    'amid vs via into up down out about than will may can could would should has have had says said say new news today live updates ' +
    'update check here what why how know all top latest key big report reports per cent percent').split(' '),
);

export function titleTokens(title: string): Set<string> {
  const words = title
    .toLowerCase()
    .replace(/[’']s\b/g, '')
    .replace(/[^a-z0-9.%₹$ ]+/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^\.+|\.+$/g, ''))
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);
  return new Set(words);
}

function stem(w: string): string {
  // Light plural folding only ("shares" -> "share", "gains" -> "gain").
  if (/^\d/.test(w) || w.length <= 3 || w.endsWith('ss')) return w;
  return w.endsWith('s') ? w.slice(0, -1) : w;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export const DUPLICATE_THRESHOLD = 0.6;

export function isNearDuplicate(tokens: Set<string>, existing: Iterable<Set<string>>, threshold = DUPLICATE_THRESHOLD): boolean {
  if (tokens.size < 3) return false; // too short to judge safely
  for (const e of existing) if (jaccard(tokens, e) >= threshold) return true;
  return false;
}

/** Removes near-duplicates within a list, keeping the first (caller sorts by preference). */
export function dedupeList<T>(items: T[], titleOf: (t: T) => string, existing: Set<string>[] = []): { kept: T[]; dropped: T[] } {
  const seen = [...existing];
  const kept: T[] = [];
  const dropped: T[] = [];
  for (const it of items) {
    const tok = titleTokens(titleOf(it));
    if (isNearDuplicate(tok, seen)) dropped.push(it);
    else {
      kept.push(it);
      seen.push(tok);
    }
  }
  return { kept, dropped };
}
