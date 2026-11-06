import { router } from 'expo-router';
import { Fragment, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';

import { Avatar, Card, CategoryIcon, Divider, EmptyState, IconBadge, Loading, Screen, Txt } from '@/components/ui';
import { useData, type Activity } from '@/lib/data';
import { timeAgo } from '@/lib/dates';
import { formatMoney, myShareOf } from '@/lib/money';
import { useColors } from '@/lib/theme';

function describe(a: Activity, actor: string, nameOf: (id: string) => string, meId: string) {
  const what = a.description ? `"${a.description}"` : '';
  const inGroup = a.group_name ? ` in "${a.group_name}"` : '';
  switch (a.kind) {
    case 'expense_added':
      return `${actor} added ${what}${inGroup}.`;
    case 'expense_updated':
      return `${actor} updated ${what}${inGroup}.`;
    case 'expense_deleted':
      return `${actor} deleted ${what}${inGroup}.`;
    case 'payment_added':
      return `${actor} recorded a payment${inGroup}.`;
    case 'payment_updated':
      return `${actor} updated a payment${inGroup}.`;
    case 'payment_deleted':
      return `${actor} deleted a payment${inGroup}.`;
    case 'group_created':
      return `${actor} created the group "${a.group_name}".`;
    case 'group_deleted':
      return `${actor} deleted the group "${a.group_name}".`;
    case 'member_added': {
      const other = a.involved.find((x) => x !== a.actor_id);
      return `${actor} added ${other === meId ? 'you' : nameOf(other ?? '')} to "${a.group_name}".`;
    }
    case 'friend_added': {
      const other = a.involved.find((x) => x !== a.actor_id);
      return `${actor} added ${other === meId ? 'you' : nameOf(other ?? '')} as a friend.`;
    }
    default:
      return `${actor} did something.`;
  }
}

export default function ActivityTab() {
  const c = useColors();
  const { me, activity, expensesById, nameOf, loading, refresh } = useData();
  const [refreshing, setRefreshing] = useState(false);
  if (loading && !me) return <Loading />;

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={c.brand}
          onRefresh={async () => {
            setRefreshing(true);
            await refresh();
            setRefreshing(false);
          }}
        />
      }>
      {activity.length === 0 ? (
        <EmptyState icon="pulse-outline" title="Nothing yet" text="Everything you and your friends add shows up here." />
      ) : (
        <Card padded={false}>
          {activity.map((a, i) => {
            const exp = a.expense_id ? expensesById.get(a.expense_id) : undefined;
            const actor = nameOf(a.actor_id);
            const deleted = a.kind.endsWith('_deleted');
            let impact: { text: string; color: string } | null = null;
            if (exp && me && !deleted) {
              const mine = myShareOf(exp, me.id);
              if (exp.is_payment) impact = { text: formatMoney(exp.amount, exp.currency), color: c.textMuted };
              else if (mine.net > 0) impact = { text: `You get back ${formatMoney(mine.net, exp.currency)}`, color: c.owed };
              else if (mine.net < 0) impact = { text: `You owe ${formatMoney(-mine.net, exp.currency)}`, color: c.owe };
              else if (!mine.involved) impact = { text: 'You are not involved', color: c.textMuted };
            } else if (deleted && a.amount != null && a.currency) {
              impact = { text: formatMoney(a.amount, a.currency), color: c.textMuted };
            }
            const icon = exp ? (
              <CategoryIcon category={exp.category} isPayment={exp.is_payment} size={42} />
            ) : a.kind.startsWith('group') || a.kind === 'member_added' ? (
              <IconBadge icon="people" color={c.brand} size={42} />
            ) : a.kind.endsWith('_deleted') ? (
              <IconBadge icon="trash-outline" color={c.danger} size={42} />
            ) : (
              <Avatar name={nameOf(a.actor_id, { you: false })} seed={a.actor_id ?? 'x'} size={42} />
            );
            return (
              <Fragment key={a.id}>
                {i > 0 ? <Divider inset={68} /> : null}
                <Pressable
                  disabled={!exp}
                  onPress={() => exp && router.push({ pathname: '/expense/[id]', params: { id: exp.id } })}
                  style={({ pressed }) => [{ flexDirection: 'row', gap: 12, padding: 14, alignItems: 'center' }, pressed && { backgroundColor: c.cardAlt }]}>
                  {icon}
                  <View style={{ flex: 1, gap: 3 }}>
                    <Txt size={15} style={deleted ? { textDecorationLine: 'line-through' } : undefined}>
                      {describe(a, actor, (id) => nameOf(id), me?.id ?? '')}
                    </Txt>
                    {impact ? <Txt size={13} weight="600" color={impact.color}>{impact.text}</Txt> : null}
                    <Txt size={12} muted>{timeAgo(a.created_at)}</Txt>
                  </View>
                </Pressable>
              </Fragment>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}
