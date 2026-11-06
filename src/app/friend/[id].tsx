import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useLayoutEffect, useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { ExpenseList } from '@/components/expense-list';
import { Avatar, Button, Card, EmptyState, Screen, TotalsText, Txt, confirm, showError } from '@/components/ui';
import { useData } from '@/lib/data';
import { balanceWith, formatMoney } from '@/lib/money';
import { errorMessage } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

export default function FriendDetail() {
  const c = useColors();
  const nav = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me, profiles, debts, expenses, groupsById, actions } = useData();
  const friend = profiles.get(id);

  const totals = me ? balanceWith(debts, me.id, id) : new Map();
  const perGroup = useMemo(() => {
    if (!me) return [];
    return debts
      .filter((d) => (d.from === me.id && d.to === id) || (d.from === id && d.to === me.id))
      .map((d) => ({ ...d, sign: d.to === me.id ? 1 : -1 }));
  }, [debts, me, id]);

  const shared = useMemo(() => {
    if (!me) return [];
    return expenses.filter((e) => {
      const ids = e.shares.map((s) => s.profile_id);
      return ids.includes(me.id) && ids.includes(id);
    });
  }, [expenses, me, id]);

  useLayoutEffect(() => {
    nav.setOptions({
      title: friend?.name ?? '',
      headerRight: () => (
        <Pressable
          hitSlop={10}
          style={{ marginRight: 8 }}
          onPress={async () => {
            if (totals.size > 0) return showError('Settle up first, then you can remove this friend.');
            if (!(await confirm('Remove friend?', `${friend?.name} will be removed from your friends list.`, 'Remove', true))) return;
            try {
              await actions.removeFriend(id);
              router.back();
            } catch (e) {
              showError(errorMessage(e));
            }
          }}>
          <Ionicons name="person-remove-outline" size={22} color={c.textMuted} />
        </Pressable>
      ),
    });
  }, [nav, friend, totals.size, actions, id, c]);

  if (!me || !friend) return <Screen><EmptyState icon="person-outline" title="Not found" text="This person is not in your friends list." /></Screen>;

  return (
    <Screen>
      <Card style={{ alignItems: 'center', gap: 8 }}>
        <Avatar name={friend.name} seed={friend.id} size={72} />
        <Txt size={22} weight="800">{friend.name}</Txt>
        <Txt muted size={13}>{friend.email}{friend.user_id ? '' : ' · not joined yet'}</Txt>
        <View style={{ marginTop: 4 }}>
          <TotalsText totals={totals} size={16} owedLabel={`${friend.name} owes you`} oweLabel={`you owe ${friend.name}`} settledLabel="You are all settled up" />
        </View>
        {perGroup.length > 1 || (perGroup.length === 1 && perGroup[0].groupId) ? (
          <View style={{ alignSelf: 'stretch', gap: 4, marginTop: 6, padding: 10, backgroundColor: c.cardAlt, borderRadius: 12 }}>
            {perGroup.map((d) => (
              <Txt key={`${d.groupId}-${d.currency}`} size={13} color={d.sign > 0 ? c.owed : c.owe}>
                {d.groupId ? `In "${groupsById.get(d.groupId)?.name}"` : 'Outside groups'}: {d.sign > 0 ? `${friend.name} owes you` : 'you owe'} {formatMoney(d.cents, d.currency)}
              </Txt>
            ))}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, alignSelf: 'stretch' }}>
          <Button title="Settle up" variant="orange" icon="cash-outline" small style={{ flex: 1 }} onPress={() => router.push({ pathname: '/settle', params: { friendId: id } })} />
          <Button title="Add expense" icon="add" small style={{ flex: 1 }} onPress={() => router.push({ pathname: '/expense/new', params: { friendId: id } })} />
        </View>
      </Card>
      {shared.length === 0 ? (
        <EmptyState icon="receipt-outline" title="No expenses yet" text={`Add an expense to start splitting with ${friend.name}.`} />
      ) : (
        <ExpenseList expenses={shared} showGroup />
      )}
    </Screen>
  );
}
