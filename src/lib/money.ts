// Pure money logic. Everything is done in integer cents to avoid rounding bugs.

export type Currency = { code: string; symbol: string; name: string; flag: string };

export const CURRENCIES: Currency[] = [
  { code: 'AED', symbol: 'AED ', name: 'UAE Dirham', flag: '🇦🇪' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'PKR', symbol: 'Rs ', name: 'Pakistani Rupee', flag: '🇵🇰' },
  { code: 'SAR', symbol: 'SAR ', name: 'Saudi Riyal', flag: '🇸🇦' },
  { code: 'QAR', symbol: 'QAR ', name: 'Qatari Riyal', flag: '🇶🇦' },
  { code: 'OMR', symbol: 'OMR ', name: 'Omani Rial', flag: '🇴🇲' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', flag: '🇪🇬' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', flag: '🇹🇷' },
  { code: 'CHF', symbol: 'CHF ', name: 'Swiss Franc', flag: '🇨🇭' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
];

export function currencyInfo(code: string): Currency {
  return CURRENCIES.find((c) => c.code === code) ?? { code, symbol: code + ' ', name: code, flag: '💱' };
}

export function toCents(value: number | string | null | undefined): number {
  const n = typeof value === 'string' ? parseFloat(value) : value ?? 0;
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

/** Parses user input like "1,234.5" or "12,50" into cents. Returns null when invalid. */
export function parseAmount(input: string): number | null {
  let s = input.trim().replace(/\s/g, '');
  if (!s) return null;
  // "12,50" (comma as decimal) -> "12.50"; "1,234.50" -> "1234.50"
  if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  if (!/^\d*\.?\d*$/.test(s) || s === '.') return null;
  const n = parseFloat(s);
  if (!isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function formatMoney(cents: number, currency: string, opts: { sign?: boolean } = {}): string {
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = (abs % 100).toString().padStart(2, '0');
  const sign = cents < 0 ? '-' : opts.sign && cents > 0 ? '+' : '';
  return `${sign}${currencyInfo(currency).symbol}${whole}.${frac}`;
}

/** Splits total cents by weights using the largest remainder method, so parts always add up exactly. */
export function splitByWeights(totalCents: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0 || sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (totalCents * w) / sum);
  const parts = raw.map((r) => Math.floor(r));
  let remainder = totalCents - parts.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  // The remainder is always smaller than the number of parts with a fractional piece.
  for (let k = 0; k < order.length && remainder > 0; k++, remainder--) parts[order[k].i] += 1;
  return parts;
}

export type Share = { profile_id: string; paid: number; owed: number }; // cents

export type Expense = {
  id: string;
  group_id: string | null;
  description: string;
  amount: number; // cents
  currency: string;
  category: string;
  split_type: string;
  is_payment: boolean;
  date: string;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  shares: Share[];
};

/** A debt: `from` owes `to` `cents` in `currency`, inside `groupId` (null = not in a group). */
export type Debt = { from: string; to: string; cents: number; currency: string; groupId: string | null };

/** Who owes whom for a single expense. Handles multiple payers by spreading proportionally. */
export function expenseDebts(shares: Share[]): { from: string; to: string; cents: number }[] {
  const nets = shares.map((s) => ({ id: s.profile_id, net: s.paid - s.owed }));
  const creditors = nets.filter((n) => n.net > 0);
  const debtors = nets.filter((n) => n.net < 0);
  const totalCredit = creditors.reduce((a, c) => a + c.net, 0);
  const out: { from: string; to: string; cents: number }[] = [];
  if (totalCredit === 0) return out;
  for (const d of debtors) {
    const parts = splitByWeights(-d.net, creditors.map((c) => c.net));
    parts.forEach((cents, i) => {
      if (cents > 0) out.push({ from: d.id, to: creditors[i].id, cents });
    });
  }
  return out;
}

/** Net balance per person (positive = is owed money). */
export function netBalances(expenses: Expense[]): Map<string, Map<string, number>> {
  const byCurrency = new Map<string, Map<string, number>>();
  for (const e of expenses) {
    const m = byCurrency.get(e.currency) ?? new Map<string, number>();
    for (const s of e.shares) m.set(s.profile_id, (m.get(s.profile_id) ?? 0) + s.paid - s.owed);
    byCurrency.set(e.currency, m);
  }
  return byCurrency;
}

/** Fewest payments that settle all net balances (greedy: biggest debtor pays biggest creditor). */
export function simplify(nets: Map<string, number>): { from: string; to: string; cents: number }[] {
  const creditors = [...nets].filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const debtors = [...nets].filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const out: { from: string; to: string; cents: number }[] = [];
  const sortDesc = (a: { id: string; v: number }, b: { id: string; v: number }) => b.v - a.v || a.id.localeCompare(b.id);
  creditors.sort(sortDesc);
  debtors.sort(sortDesc);
  while (creditors.length && debtors.length) {
    const c = creditors[0];
    const d = debtors[0];
    const x = Math.min(c.v, d.v);
    if (x > 0) out.push({ from: d.id, to: c.id, cents: x });
    c.v -= x;
    d.v -= x;
    if (c.v === 0) creditors.shift();
    if (d.v === 0) debtors.shift();
    creditors.sort(sortDesc);
    debtors.sort(sortDesc);
  }
  return out;
}

/** Pairwise debts summed and netted in each direction. */
function netPairwise(list: { from: string; to: string; cents: number }[]) {
  const pair = new Map<string, number>(); // key "a|b" with a<b: positive => a owes b
  for (const d of list) {
    const [a, b, sign] = d.from < d.to ? [d.from, d.to, 1] : [d.to, d.from, -1];
    const k = `${a}|${b}`;
    pair.set(k, (pair.get(k) ?? 0) + sign * d.cents);
  }
  const out: { from: string; to: string; cents: number }[] = [];
  for (const [k, v] of pair) {
    if (v === 0) continue;
    const [a, b] = k.split('|');
    out.push(v > 0 ? { from: a, to: b, cents: v } : { from: b, to: a, cents: -v });
  }
  return out;
}

/**
 * The full debt graph, the single source of truth for every balance in the app.
 * Group expenses are settled per group (simplified when the group has it on),
 * non group expenses are netted per pair of people. All per currency.
 */
export function computeDebts(expenses: Expense[], simplifyByGroup: Map<string, boolean>): Debt[] {
  const buckets = new Map<string, Expense[]>();
  for (const e of expenses) {
    const k = `${e.group_id ?? ''}::${e.currency}`;
    const arr = buckets.get(k) ?? [];
    arr.push(e);
    buckets.set(k, arr);
  }
  const out: Debt[] = [];
  for (const [k, list] of buckets) {
    const [g, currency] = k.split('::');
    const groupId = g || null;
    let edges: { from: string; to: string; cents: number }[];
    if (groupId && simplifyByGroup.get(groupId)) {
      edges = simplify(netBalances(list).get(currency) ?? new Map());
    } else {
      edges = netPairwise(list.flatMap((e) => expenseDebts(e.shares)));
    }
    for (const e of edges) out.push({ ...e, currency, groupId });
  }
  return out;
}

/** Totals per currency from my point of view: positive = I am owed. */
export type Totals = Map<string, number>;

export function addTo(t: Totals, currency: string, cents: number) {
  const v = (t.get(currency) ?? 0) + cents;
  if (v === 0) t.delete(currency);
  else t.set(currency, v);
}

export function balanceWith(debts: Debt[], me: string, other: string, groupId?: string | null): Totals {
  const t: Totals = new Map();
  for (const d of debts) {
    if (groupId !== undefined && d.groupId !== groupId) continue;
    if (d.from === other && d.to === me) addTo(t, d.currency, d.cents);
    else if (d.from === me && d.to === other) addTo(t, d.currency, -d.cents);
  }
  return t;
}

export function myTotals(debts: Debt[], me: string, groupId?: string | null): Totals {
  const t: Totals = new Map();
  for (const d of debts) {
    if (groupId !== undefined && d.groupId !== groupId) continue;
    if (d.to === me) addTo(t, d.currency, d.cents);
    else if (d.from === me) addTo(t, d.currency, -d.cents);
  }
  return t;
}

/** What one person paid and owed in an expense, from their point of view (cents, positive = lent). */
export function myShareOf(e: Expense, me: string): { paid: number; owed: number; net: number; involved: boolean } {
  const s = e.shares.find((x) => x.profile_id === me);
  if (!s) return { paid: 0, owed: 0, net: 0, involved: false };
  return { paid: s.paid, owed: s.owed, net: s.paid - s.owed, involved: true };
}
