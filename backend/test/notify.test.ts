import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMessage, eligible } from '../src/notify/notify';
import { inQuietHours, isExpoToken, istParts, sendPush } from '../src/notify/push';

afterEach(() => vi.unstubAllGlobals());

// 2026-11-26 10:00 IST = 04:30 UTC; 23:00 IST = 17:30 UTC
const DAY_IST = Date.parse('2026-11-26T04:30:00Z');
const NIGHT_IST = Date.parse('2026-11-26T17:30:00Z');
const dev = (over: Partial<{ token: string; region: string; quiet_hours: number; sent_day: string | null; sent_count: number }> = {}) => ({
  token: 'ExponentPushToken[abcdefghijklmn]', region: 'all', quiet_hours: 1, sent_day: null, sent_count: 0, ...over,
});

describe('time helpers', () => {
  it('uses Indian time', () => {
    expect(istParts(DAY_IST)).toEqual({ day: '2026-11-26', hour: 10 });
    expect(inQuietHours(DAY_IST)).toBe(false);
    expect(inQuietHours(NIGHT_IST)).toBe(true);
  });
});

describe('eligible', () => {
  it('matches region', () => {
    const ds = [dev({ token: 'a', region: 'all' }), dev({ token: 'b', region: 'india' }), dev({ token: 'c', region: 'global' })];
    expect(eligible(ds, 'india', DAY_IST, 8).map((d) => d.token)).toEqual(['a', 'b']);
    expect(eligible(ds, 'global', DAY_IST, 8).map((d) => d.token)).toEqual(['a', 'c']);
    expect(eligible(ds, 'both', DAY_IST, 8).map((d) => d.token)).toEqual(['a', 'b', 'c']);
  });
  it('respects quiet hours and the daily limit', () => {
    const ds = [dev({ token: 'quiet' }), dev({ token: 'night-owl', quiet_hours: 0 }), dev({ token: 'capped', quiet_hours: 0, sent_day: '2026-11-26', sent_count: 8 }), dev({ token: 'yesterday', quiet_hours: 0, sent_day: '2026-11-25', sent_count: 8 })];
    expect(eligible(ds, 'india', NIGHT_IST, 8).map((d) => d.token)).toEqual(['night-owl', 'yesterday']);
  });
});

describe('messages', () => {
  it('uses the headline as title and the first summary sentence as body', () => {
    const m = buildMessage('T', { id: 's1', title: 'RBI keeps repo rate at 5.5%', summary: 'The RBI kept rates unchanged. It also cut CRR.', category: 'policy', region: 'india', region_impact: 'india' });
    expect(m).toMatchObject({ to: 'T', title: 'RBI keeps repo rate at 5.5%', body: 'Policy & RBI · The RBI kept rates unchanged.', data: { storyId: 's1' }, channelId: 'breaking' });
  });
  it('validates Expo tokens', () => {
    expect(isExpoToken('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]')).toBe(true);
    expect(isExpoToken('hello')).toBe(false);
    expect(isExpoToken("ExponentPushToken['; DROP TABLE]")).toBe(false);
  });
});

describe('sendPush', () => {
  it('counts successes and reports tokens to remove', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => {
      const msgs = JSON.parse(init.body as string) as { to: string }[];
      return new Response(JSON.stringify({ data: msgs.map((m) => (m.to === 'gone' ? { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } } : { status: 'ok', id: 'x' })) }));
    }));
    const r = await sendPush(['a', 'gone', 'b'].map((to) => ({ to, title: 't', body: 'b', data: {} })));
    expect(r).toEqual({ sent: 2, invalid: ['gone'], errors: [] });
  });
});

describe('sendTestPush', () => {
  it('reports Apple credential problems from the receipt', async () => {
    const { sendTestPush } = await import('../src/notify/push');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/send')) return new Response(JSON.stringify({ data: [{ status: 'ok', id: 'r1' }] }));
      return new Response(JSON.stringify({ data: { r1: { status: 'error', message: 'Could not find APNs credentials', details: { error: 'InvalidCredentials' } } } }));
    }));
    const r = await sendTestPush('ExponentPushToken[abcdefghijklmn]', async () => {});
    expect(r).toEqual({ ok: false, stage: 'delivery', error: 'InvalidCredentials', message: 'Could not find APNs credentials' });
  });
  it('reports success when the receipt is ok', async () => {
    const { sendTestPush } = await import('../src/notify/push');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(url.endsWith('/send') ? { data: [{ status: 'ok', id: 'r1' }] } : { data: { r1: { status: 'ok' } } }))));
    expect((await sendTestPush('ExponentPushToken[abcdefghijklmn]', async () => {})).ok).toBe(true);
  });
});
