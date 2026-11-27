import { describe, expect, it } from 'vitest';
import { digestDay, digestPrompt, dueDigests, istClock, nyClock, validateDigest } from '../src/notify/digest';

// Thursday 26 Nov 2026; IST = UTC + 5:30
const at = (istHHMM: string, date = '2026-11-26') => Date.parse(`${date}T${istHHMM}:00+05:30`);
const stories = [
  { title: 'Sensex rises 312 points as IT stocks gain', summary: 'The Sensex rose 312 points to 84,640 led by Infosys.', source: 'ET', region: 'india' },
  { title: 'US stocks close higher', summary: 'The Nasdaq gained 1.2% overnight.', source: 'MW', region: 'global' },
];

describe('schedule', () => {
  it('runs the morning note 8:40–9:10 and the Indian open 9:30–10:00 IST on weekdays', () => {
    expect(dueDigests(at('08:39'))).toEqual([]);
    expect(dueDigests(at('08:45'))).toEqual(['morning']);
    expect(dueDigests(at('09:09'))).toEqual(['morning']);
    expect(dueDigests(at('09:20'))).toEqual([]);
    expect(dueDigests(at('09:30'))).toEqual(['market_open']);
    expect(dueDigests(at('09:59'))).toEqual(['market_open']);
    expect(dueDigests(at('10:00'))).toEqual([]);
  });
  it('runs the Wall Street open 9:50–10:20 New York time, following US daylight saving', () => {
    // 26 Nov 2026: New York is on EST (UTC-5) -> 9:50 NY = 20:20 IST
    expect(dueDigests(Date.parse('2026-11-26T09:55:00-05:00'))).toEqual(['us_open']);
    expect(dueDigests(Date.parse('2026-11-26T09:45:00-05:00'))).toEqual([]);
    // 15 Jul 2026: EDT (UTC-4)
    expect(dueDigests(Date.parse('2026-07-15T10:10:00-04:00'))).toEqual(['us_open']);
    expect(nyClock(Date.parse('2026-07-15T10:10:00-04:00'))).toEqual({ minutes: 610, weekday: 3, day: '2026-07-15' });
  });
  it('skips weekends', () => {
    expect(dueDigests(at('08:45', '2026-11-28'))).toEqual([]); // Saturday
    expect(dueDigests(at('09:30', '2026-11-29'))).toEqual([]); // Sunday
    expect(dueDigests(Date.parse('2026-11-28T10:00:00-05:00'))).toEqual([]); // Saturday in New York
  });
  it('reads Indian time and uses the right calendar day', () => {
    expect(istClock(at('09:15'))).toEqual({ minutes: 555, weekday: 4, day: '2026-11-26' });
    // 10:00 NY on 26 Nov is already 27 Nov in India; the US note belongs to 26 Nov.
    expect(digestDay('us_open', Date.parse('2026-11-26T10:00:00-05:00'))).toBe('2026-11-26');
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
  it('builds a prompt per audience', () => {
    expect(digestPrompt('morning', stories, 'india')).toContain('for Indian investors');
    expect(digestPrompt('morning', stories, 'global')).toContain('world markets');
    expect(digestPrompt('us_open', stories)).toContain('Wall Street');
    expect(digestPrompt('morning', stories)).toContain('Sensex rises 312 points');
  });
});
