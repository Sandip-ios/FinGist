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
