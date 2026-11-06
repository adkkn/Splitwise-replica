import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Fragment, useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { ExpenseList } from '@/components/expense-list';
import { Avatar, Button, Card, Divider, EmptyState, Fab, IconBadge, Row, Screen, Segmented, TotalsText, Txt } from '@/components/ui';
import { useData } from '@/lib/data';
import { formatMoney, myTotals, netBalances } from '@/lib/money';
import { groupKindInfo, useColors } from '@/lib/theme';

export default function GroupDetail() {
  const c = useColors();
  const nav = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me, groupsById, expenses, debts, nameOf } = useData();
  const group = groupsById.get(id);
  const [tab, setTab] = useState<'expenses' | 'balances' | 'totals'>('expenses');
  const [query, setQuery] = useState('');

  useLayoutEffect(() => {
    nav.setOptions({
      title: group?.name ?? '',
      headerRight: () => (
        <Pressable hitSlop={10} style={{ marginRight: 8 }} onPress={() => router.push({ pathname: '/group/[id]/settings', params: { id } })}>
          <Ionicons name="settings-outline" size={22} color={c.text} />
        </Pressable>
      ),
    });
  }, [nav, group, id, c]);

  const groupExpenses = useMemo(() => expenses.filter((e) => e.group_id === id), [expenses, id]);
  const groupDebts = useMemo(() => debts.filter((d) => d.groupId === id), [debts, id]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? groupExpenses.filter((e) => e.description.toLowerCase().includes(q)) : groupExpenses;
  }, [groupExpenses, query]);

  if (!me || !group) return <Screen><EmptyState icon="people-outline" title="Group not found" text="It may have been deleted, or you were removed." /></Screen>;

  const totals = myTotals(debts, me.id, id);
  const nets = netBalances(groupExpenses);
  const spending = new Map<string, number>();
  const mySpending = new Map<string, number>();
  for (const e of groupExpenses) {
    if (e.is_payment) continue;
    spending.set(e.currency, (spending.get(e.currency) ?? 0) + e.amount);
    const mine = e.shares.find((s) => s.profile_id === me.id)?.owed ?? 0;
    mySpending.set(e.currency, (mySpending.get(e.currency) ?? 0) + mine);
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <IconBadge icon={groupKindInfo(group.kind).icon} color={c.brand} size={56} rounded={16} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt size={20} weight="800" numberOfLines={1}>{group.name}</Txt>
              <Txt size={13} muted>{group.memberIds.length} people · {group.currency}{group.simplify_debts ? ' · simplified' : ''}</Txt>
            </View>
          </View>
          <TotalsText totals={totals} size={16} settledLabel="You are all settled up in this group" />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <Button title="Settle up" variant="orange" icon="cash-outline" style={{ flex: 1 }} small onPress={() => router.push({ pathname: '/settle', params: { groupId: id } })} />
            <Button
              title="Add people"
              variant="secondary"
              icon="person-add-outline"
              style={{ flex: 1 }}
              small
              onPress={() => router.push({ pathname: '/group/[id]/settings', params: { id } })}
            />
          </View>
        </Card>

        <Segmented
          options={[
            { key: 'expenses', label: 'Expenses' },
            { key: 'balances', label: 'Balances' },
            { key: 'totals', label: 'Totals' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'expenses' ? (
          groupExpenses.length === 0 ? (
            <EmptyState icon="receipt-outline" title="No expenses yet" text="Tap Add expense to log the first one." />
          ) : (
            <>
              {groupExpenses.length > 8 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12 }}>
                  <Ionicons name="search" size={18} color={c.textMuted} />
                  <SearchInput value={query} onChange={setQuery} />
                </View>
              ) : null}
              <ExpenseList expenses={filtered} />
            </>
          )
        ) : null}

        {tab === 'balances' ? (
          <>
            <Card padded={false}>
              {group.memberIds.map((pid, i) => {
                const t = new Map<string, number>();
                for (const [cur, m] of nets) if (m.get(pid)) t.set(cur, m.get(pid)!);
                return (
                  <Fragment key={pid}>
                    {i > 0 ? <Divider inset={68} /> : null}
                    <Row
                      left={<Avatar name={nameOf(pid, { you: false })} seed={pid} />}
                      title={nameOf(pid)}
                      right={<TotalsText totals={t} align="right" owedLabel="gets back" oweLabel="owes" settledLabel="settled up" />}
                    />
                  </Fragment>
                );
              })}
            </Card>
            <Txt size={13} weight="700" muted style={{ marginTop: 6 }}>
              {group.simplify_debts ? 'SIMPLIFIED PAYMENTS' : 'WHO OWES WHOM'}
            </Txt>
            <Card padded={false}>
              {groupDebts.length === 0 ? <Txt muted center style={{ padding: 18 }}>Everyone is settled up.</Txt> : null}
              {groupDebts.map((d, i) => (
                <Fragment key={`${d.from}-${d.to}-${d.currency}`}>
                  {i > 0 ? <Divider inset={16} /> : null}
                  <Row
                    title={`${nameOf(d.from)} ${d.from === me.id ? 'owe' : 'owes'} ${nameOf(d.to, { you: true }).replace(/^You$/, 'you')}`}
                    right={<Txt weight="700" color={d.from === me.id ? c.owe : d.to === me.id ? c.owed : c.text}>{formatMoney(d.cents, d.currency)}</Txt>}
                    onPress={() => router.push({ pathname: '/settle', params: { groupId: id } })}
                  />
                </Fragment>
              ))}
            </Card>
          </>
        ) : null}

        {tab === 'totals' ? (
          <Card style={{ gap: 12 }}>
            <Txt size={13} weight="700" muted>TOTAL GROUP SPENDING</Txt>
            {spending.size === 0 ? <Txt muted>Nothing yet.</Txt> : [...spending].map(([cur, v]) => <Txt key={cur} size={24} weight="800">{formatMoney(v, cur)}</Txt>)}
            <Divider />
            <Txt size={13} weight="700" muted>YOUR SHARE OF IT</Txt>
            {mySpending.size === 0 ? <Txt muted>Nothing yet.</Txt> : [...mySpending].map(([cur, v]) => <Txt key={cur} size={20} weight="700" color={c.brand}>{formatMoney(v, cur)}</Txt>)}
          </Card>
        ) : null}
        <View style={{ height: 70 }} />
      </Screen>
      <Fab onPress={() => router.push({ pathname: '/expense/new', params: { groupId: id } })} />
    </View>
  );
}

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const c = useColors();
  return <TextInput value={value} onChangeText={onChange} placeholder="Search expenses" placeholderTextColor={c.textMuted} style={{ flex: 1, padding: 10, color: c.text, fontSize: 15 }} />;
}
