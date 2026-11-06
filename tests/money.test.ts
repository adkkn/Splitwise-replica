import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  balanceWith,
  computeDebts,
  expenseDebts,
  formatMoney,
  myTotals,
  parseAmount,
  simplify,
  splitByWeights,
  type Expense,
} from '../src/lib/money.ts';

let n = 0;
function exp(group: string | null, currency: string, shares: [string, number, number][], is_payment = false): Expense {
  const amount = shares.reduce((a, s) => a + s[1], 0);
  return {
    id: String(++n), group_id: group, description: 'x', amount, currency, category: 'general',
    split_type: 'equal', is_payment, date: '2026-01-01', notes: null, created_by: null, updated_by: null,
    created_at: '', updated_at: '',
    shares: shares.map(([profile_id, paid, owed]) => ({ profile_id, paid, owed })),
  };
}

test('splitByWeights always adds up exactly', () => {
  assert.deepEqual(splitByWeights(10000, [1, 1, 1]), [3334, 3333, 3333]);
  assert.deepEqual(splitByWeights(100, [1, 1, 1, 1, 1, 1, 1]).reduce((a, b) => a + b), 100);
  assert.deepEqual(splitByWeights(1000, [50, 30, 20]), [500, 300, 200]);
  assert.deepEqual(splitByWeights(999, [2, 1]), [666, 333]);
  assert.deepEqual(splitByWeights(500, [0, 1, 0]), [0, 500, 0]);
  for (let t = 0; t < 2000; t += 7) {
    const parts = splitByWeights(t, [3, 7, 1, 0, 2]);
    assert.equal(parts.reduce((a, b) => a + b), t);
  }
});

test('parseAmount and formatMoney', () => {
  assert.equal(parseAmount('12.5'), 1250);
  assert.equal(parseAmount('12,50'), 1250);
  assert.equal(parseAmount('1,234.56'), 123456);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount(''), null);
  assert.equal(formatMoney(123456, 'EUR'), '€1,234.56');
  assert.equal(formatMoney(-5000, 'AED'), '-AED 50.00');
});

test('single payer debts', () => {
  const d = expenseDebts(exp(null, 'EUR', [['a', 9000, 3000], ['b', 0, 3000], ['c', 0, 3000]]).shares);
  assert.deepEqual(d, [{ from: 'b', to: 'a', cents: 3000 }, { from: 'c', to: 'a', cents: 3000 }]);
});

test('multiple payers spread proportionally', () => {
  const d = expenseDebts(exp(null, 'EUR', [['a', 6000, 3000], ['b', 3000, 3000], ['c', 0, 3000]]).shares);
  assert.deepEqual(d, [{ from: 'c', to: 'a', cents: 3000 }]);
});

test('simplify reduces chain a->b->c to a->c', () => {
  const nets = new Map([['a', -1000], ['b', 0], ['c', 1000]]);
  assert.deepEqual(simplify(nets), [{ from: 'a', to: 'c', cents: 1000 }]);
});

test('group with simplify vs without, and payments settle up', () => {
  const es = [
    exp('g', 'EUR', [['b', 1000, 0], ['a', 0, 1000]]), // a owes b 10
    exp('g', 'EUR', [['c', 1000, 0], ['b', 0, 1000]]), // b owes c 10
  ];
  const simple = computeDebts(es, new Map([['g', true]]));
  assert.deepEqual(simple.map((d) => [d.from, d.to, d.cents]), [['a', 'c', 1000]]);
  const raw = computeDebts(es, new Map([['g', false]]));
  assert.equal(raw.length, 2);

  es.push(exp('g', 'EUR', [['a', 1000, 0], ['c', 0, 1000]], true)); // a pays c
  assert.equal(computeDebts(es, new Map([['g', true]])).length, 0);
});

test('currencies are kept apart and friend balances combine groups', () => {
  const es = [
    exp('g', 'EUR', [['me', 2000, 1000], ['bob', 0, 1000]]),
    exp(null, 'AED', [['me', 0, 2500], ['bob', 5000, 2500]]),
    exp(null, 'AED', [['me', 1000, 500], ['bob', 0, 500]]),
  ];
  const debts = computeDebts(es, new Map([['g', true]]));
  const withBob = balanceWith(debts, 'me', 'bob');
  assert.equal(withBob.get('EUR'), 1000);
  assert.equal(withBob.get('AED'), -2000);
  assert.deepEqual([...myTotals(debts, 'me', 'g')], [['EUR', 1000]]);
  assert.deepEqual([...myTotals(debts, 'me', null)], [['AED', -2000]]);
});
