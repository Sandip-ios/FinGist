/** Expo push service: one HTTP API for both Apple (APNs) and Google (FCM). */
export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound?: 'default';
  channelId?: string;
  priority?: 'default' | 'high';
}

export interface PushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export function isExpoToken(t: unknown): t is string {
  return typeof t === 'string' && /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,}\]$/.test(t);
}

/** Sends in chunks of 100 (Expo's limit). Returns tokens Expo says are no longer valid. */
export async function sendPush(messages: PushMessage[]): Promise<{ sent: number; invalid: string[]; errors: string[] }> {
  const invalid: string[] = [];
  const errors: string[] = [];
  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) { errors.push(`Expo HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`); continue; }
      const data = (await res.json()) as { data?: PushTicket[] };
      (data.data ?? []).forEach((t, j) => {
        if (t.status === 'ok') sent++;
        else if (t.details?.error === 'DeviceNotRegistered') invalid.push(chunk[j]!.to);
        else errors.push(t.message ?? t.details?.error ?? 'unknown error');
      });
    } catch (e) {
      errors.push(String((e as Error).message));
    }
  }
  return { sent, invalid, errors };
}

/** Date and hour in India (alerts follow Indian time for quiet hours and daily limits). */
export function istParts(now: number): { day: string; hour: number } {
  const ist = new Date(now + 5.5 * 3_600_000);
  return { day: ist.toISOString().slice(0, 10), hour: ist.getUTCHours() };
}

export function inQuietHours(now: number): boolean {
  const { hour } = istParts(now);
  return hour >= 22 || hour < 7;
}

export const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

/**
 * Sends one test notification and reports what happened, including Apple/Google errors that only
 * show up in Expo's delivery receipt (for example missing push credentials for a new build).
 */
export async function sendTestPush(token: string, wait = (ms: number) => new Promise((r) => setTimeout(r, ms))): Promise<{ ok: boolean; stage: string; error?: string; message?: string }> {
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify([{ to: token, title: '✅ FinGist alerts are working', body: 'You will get market news alerts on this phone.', sound: 'default', channelId: 'breaking', data: { type: 'test' } }]),
  });
  if (!res.ok) return { ok: false, stage: 'send', error: `HTTP ${res.status}`, message: (await res.text()).slice(0, 200) };
  const ticket = ((await res.json()) as { data?: PushTicket[] }).data?.[0];
  if (!ticket || ticket.status !== 'ok' || !ticket.id) {
    return { ok: false, stage: 'send', error: ticket?.details?.error ?? 'unknown', message: ticket?.message };
  }
  // Delivery problems (e.g. InvalidCredentials, DeviceNotRegistered) appear in the receipt a moment later.
  for (const ms of [2500, 4000]) {
    await wait(ms);
    const r = await fetch(EXPO_RECEIPTS_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: [ticket.id] }) });
    if (!r.ok) continue;
    const receipt = ((await r.json()) as { data?: Record<string, PushTicket> }).data?.[ticket.id];
    if (!receipt) continue;
    if (receipt.status === 'ok') return { ok: true, stage: 'delivered to Apple/Google' };
    return { ok: false, stage: 'delivery', error: receipt.details?.error ?? 'unknown', message: receipt.message };
  }
  return { ok: true, stage: 'sent (delivery receipt not ready yet)' };
}
