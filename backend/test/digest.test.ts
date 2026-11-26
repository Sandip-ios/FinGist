import { describe, expect, it } from 'vitest';
import { digestPrompt, dueDigest, istClock, validateDigest } from '../src/notify/digest';

// Thursday 26 Nov 2026; IST = UTC + 5:30
const at = (istHHMM: string, date = '2026-11-26') => Date.parse(`${date}T${istHHMM}:00+05:30`);
const stories = [
  { title: 'Sensex rises 312 points as IT stocks gain', summary: 'The Sensex rose 312 points to 84,640 led by Infosys.', source: 'ET', region: 'india' },
  { title: 'US stocks close higher', summary: 'The Nasdaq gained 1.2% overnight.', source: 'MW', region: 'global' },
];

describe('schedule', () => {
  it('runs the morning note 8:40–9:10 and the open update 9:30–10:00 IST on weekdays', () => {
    expect(dueDigest(at('08:39'))).toBeNull();
    expect(dueDigest(at('08:45'))).toBe('morning');
    expect(dueDigest(at('09:09'))).toBe('morning');
    expect(dueDigest(at('09:20'))).toBeNull();
    expect(dueDigest(at('09:30'))).toBe('market_open');
    expect(dueDigest(at('09:59'))).toBe('market_open');
    expect(dueDigest(at('10:00'))).toBeNull();
  });
  it('skips weekends', () => {
    expect(dueDigest(at('08:45', '2026-11-28'))).toBeNull(); // Saturday
    expect(dueDigest(at('09:30', '2026-11-29'))).toBeNull(); // Sunday
  });
  it('reads Indian time', () => {
    expect(istClock(at('09:15'))).toEqual({ minutes: 555, weekday: 4, day: '2026-11-26' });
  });
});

describe('validateDigest', () => {
  it('accepts a grounded short note', () => {
    const body = 'US stocks closed higher with the Nasdaq up 1.2%. In India, the Sensex rose 312 points led by IT.';
    expect(validateDigest(body, stories)).toBe(body);
  });
  it('rejects invented numbers, predictions and advice', () => {
    expect(validateDigest('The Sensex jumped 500 points at the open today on strong buying.', stories)).toBeNull();
    expect(validateDigest('Markets will rise today after strong global cues from the US overnight.', stories)).toBeNull();
    expect(validateDigest('Investors should buy IT stocks today as the Sensex rose 312 points.', stories)).toBeNull();
  });
  it('rejects empty or overly long notes', () => {
    expect(validateDigest('', stories)).toBeNull();
    expect(validateDigest('word '.repeat(60), stories)).toBeNull();
  });
  it('builds a prompt with the stories', () => {
    expect(digestPrompt('morning', stories)).toContain('Sensex rises 312 points');
  });
});
