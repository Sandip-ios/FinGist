/** "just now", "5m ago", "3h ago", "yesterday", "24 Nov". */
export function timeAgo(ms: number, now = Date.now()): string {
  const diff = Math.max(0, now - ms);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  if (h < 48) return 'yesterday';
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
