const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function monthShort(iso: string): string {
  return MONTHS[parseISODate(iso).getMonth()].slice(0, 3);
}

export function dayOfMonth(iso: string): string {
  return String(parseISODate(iso).getDate());
}

export function monthYear(iso: string): string {
  const d = parseISODate(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function prettyDate(iso: string): string {
  if (iso === todayISO()) return 'Today';
  if (iso === addDays(todayISO(), -1)) return 'Yesterday';
  const d = parseISODate(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}${sameYear ? '' : ', ' + d.getFullYear()}`;
}

export function timeAgo(ts: string): string {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d ago`;
  return prettyDate(toISODate(new Date(ts)));
}
