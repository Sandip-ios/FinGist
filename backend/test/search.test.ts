import { describe, expect, it } from 'vitest';
import { toFtsQuery } from '../src/store/db';

describe('toFtsQuery', () => {
  it('turns words into prefix terms that must all match', () => {
    expect(toFtsQuery('Infosys results')).toBe('"infosys"* "results"*');
  });
  it('strips characters that would break FTS syntax', () => {
    expect(toFtsQuery('RBI "rate" (cut) OR NEAR*')).toBe('"rbi"* "rate"* "cut"* "or"* "near"*');
    expect(toFtsQuery('M&M')).toBe('"m&m"*');
    expect(toFtsQuery('Rs. 1,200 crore')).toBe('"rs"* "1"* "200"* "crore"*');
  });
  it('returns null for empty input', () => {
    expect(toFtsQuery('  ')).toBeNull();
    expect(toFtsQuery('"*()')).toBeNull();
  });
});
