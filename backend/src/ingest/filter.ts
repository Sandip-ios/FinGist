import type { Story } from '../types';

export function isFresh(story: Story, now: number, maxAgeHours: number): boolean {
  return now - story.publishedAt <= maxAgeHours * 3_600_000;
}

/**
 * Exchange filings include many routine compliance notices with no market value.
 * They are dropped before reaching the AI step to save quota.
 */
const ROUTINE_FILING = [
  /trading window/i,
  /newspaper (publication|advertisement)/i,
  /(loss|duplicate|issue) of (share )?certificates?/i,
  /certificate under reg(ulation|\.)?\s*(7|74)/i,
  /compliance certificate/i,
  /reg(ulation|\.)?\s*74\s*\(5\)/i,
  /statement of investor complaints/i,
  /change in (the )?(registrar|rta)/i,
  /copy of newspaper/i,
  /intimation of (closure|loss)/i,
  /\besop\b|employee stock option/i,
  /disclosure.*regulation\s*7\(3\)/i,
  /\bpostal ballot\b.*(scrutinizer|notice)/i,
  /analysts?\s*\/?\s*(institutional )?investor meet/i,
  /\b(audio|video) recording\b/i,
  /transcript of (the )?(earnings )?(conference|con\.?) call/i,
];

/** Promotional / non-news items that sometimes appear in publisher feeds. */
const NON_NEWS = [
  /\b(sponsored|advertorial|brand ?connect|partner content)\b/i,
  /\bhoroscope\b/i,
  /\b(quiz|crossword)\b/i,
  /\b(podcast|webinar)\b:?/i,
];

export function isRoutine(story: Story): boolean {
  if (story.kind === 'filing' && ROUTINE_FILING.some((r) => r.test(story.title) || r.test(story.snippet))) return true;
  return NON_NEWS.some((r) => r.test(story.title));
}
