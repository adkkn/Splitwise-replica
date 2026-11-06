import { router } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, View } from 'react-native';

import { CategoryIcon, Card, Divider, SectionTitle, Txt } from '@/components/ui';
import { useData } from '@/lib/data';
import { dayOfMonth, monthShort, monthYear } from '@/lib/dates';
import { formatMoney, myShareOf, type Expense } from '@/lib/money';
import { useColors } from '@/lib/theme';

export function ExpenseRow({ e, showGroup }: { e: Expense; showGroup?: boolean }) {
  const c = useColors();
  const { me, nameOf, groupsById } = useData();
  const mine = myShareOf(e, me?.id ?? '');
  const payers = e.shares.filter((s) => s.paid > 0);

  let subtitle: string;
  if (e.is_payment) {
    const to = e.shares.find((s) => s.owed > 0);
    subtitle = `${nameOf(payers[0]?.profile_id)} paid ${nameOf(to?.profile_id, { you: true })}`;
  } else if (payers.length === 1) {
    subtitle = `${nameOf(payers[0].profile_id)} paid ${formatMoney(e.amount, e.currency)}`;
  } else {
    subtitle = `${payers.length} people paid ${formatMoney(e.amount, e.currency)}`;
  }
  const group = showGroup && e.group_id ? groupsById.get(e.group_id) : null;

  let right: { label: string; amount: string; color: string } | null = null;
  if (e.is_payment) {
    right = { label: '', amount: formatMoney(e.amount, e.currency), color: c.textMuted };
  } else if (!mine.involved) {
    right = { label: 'not involved', amount: '', color: c.textMuted };
  } else if (mine.net > 0) {
    right = { label: 'you lent', amount: formatMoney(mine.net, e.currency), color: c.owed };
  } else if (mine.net < 0) {
    right = { label: 'you borrowed', amount: formatMoney(-mine.net, e.currency), color: c.owe };
  } else {
    right = { label: 'no balance', amount: '', color: c.textMuted };
  }

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/expense/[id]', params: { id: e.id } })}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 12 }, pressed && { backgroundColor: c.cardAlt }]}>
      <View style={{ width: 32, alignItems: 'center' }}>
        <Txt size={11} muted weight="600">{monthShort(e.date).toUpperCase()}</Txt>
        <Txt size={18} weight="700" muted>{dayOfMonth(e.date)}</Txt>
      </View>
      <CategoryIcon category={e.category} isPayment={e.is_payment} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt size={16} weight="600" numberOfLines={1} style={e.is_payment ? { fontStyle: 'italic' } : undefined}>
          {e.is_payment ? 'Payment' : e.description}
        </Txt>
        <Txt size={13} muted numberOfLines={1}>
          {subtitle}
          {group ? ` · ${group.name}` : ''}
        </Txt>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {right.label ? <Txt size={11} color={right.color}>{right.label}</Txt> : null}
        {right.amount ? <Txt size={15} weight="700" color={right.color}>{right.amount}</Txt> : null}
      </View>
    </Pressable>
  );
}

/** Expenses grouped by month in cards. */
export function ExpenseList({ expenses, showGroup }: { expenses: Expense[]; showGroup?: boolean }) {
  const sections: { title: string; items: Expense[] }[] = [];
  for (const e of expenses) {
    const t = monthYear(e.date);
    const last = sections[sections.length - 1];
    if (last && last.title === t) last.items.push(e);
    else sections.push({ title: t, items: [e] });
  }
  return (
    <>
      {sections.map((s) => (
        <Fragment key={s.title}>
          <SectionTitle>{s.title}</SectionTitle>
          <Card padded={false}>
            {s.items.map((e, i) => (
              <Fragment key={e.id}>
                {i > 0 ? <Divider inset={58} /> : null}
                <ExpenseRow e={e} showGroup={showGroup} />
              </Fragment>
            ))}
          </Card>
        </Fragment>
      ))}
    </>
  );
}
