import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Fragment, useLayoutEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Avatar, Button, Card, CategoryIcon, Divider, EmptyState, Row, Screen, Txt, confirm, showError } from '@/components/ui';
import { useData } from '@/lib/data';
import { prettyDate, timeAgo } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { errorMessage } from '@/lib/supabase';
import { categoryInfo, useColors } from '@/lib/theme';

export default function ExpenseDetail() {
  const c = useColors();
  const nav = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { expensesById, groupsById, nameOf, actions } = useData();
  const e = expensesById.get(id);
  const [deleting, setDeleting] = useState(false);

  useLayoutEffect(() => {
    nav.setOptions({
      headerRight: e
        ? () => (
            <Pressable
              hitSlop={10}
              style={{ marginRight: 8 }}
              onPress={() =>
                e.is_payment
                  ? router.push({ pathname: '/settle', params: { editId: e.id } })
                  : router.push({ pathname: '/expense/new', params: { editId: e.id } })
              }>
              <Ionicons name="create-outline" size={24} color={c.brand} />
            </Pressable>
          )
        : undefined,
    });
  }, [nav, e, c]);

  if (!e) return <Screen><EmptyState icon="trash-outline" title="Not found" text="This expense was deleted or you no longer have access to it." /></Screen>;

  const group = e.group_id ? groupsById.get(e.group_id) : undefined;
  const payment = e.is_payment;
  const from = e.shares.find((s) => s.paid > 0);
  const to = e.shares.find((s) => s.owed > 0);

  async function remove() {
    if (!(await confirm(payment ? 'Delete payment?' : 'Delete expense?', "This changes everyone's balances.", 'Delete', true))) return;
    setDeleting(true);
    try {
      await actions.deleteExpense(e!.id);
      router.back();
    } catch (err) {
      showError(errorMessage(err));
      setDeleting(false);
    }
  }

  return (
    <Screen>
      <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 24 }}>
        <CategoryIcon category={e.category} isPayment={payment} size={64} />
        <Txt size={20} weight="700" center>{payment ? 'Payment' : e.description}</Txt>
        <Txt size={34} weight="800">{formatMoney(e.amount, e.currency)}</Txt>
        <Txt muted size={13} center>
          {prettyDate(e.date)}
          {group ? ` · ${group.name}` : ''}
          {!payment ? ` · ${categoryInfo(e.category).label}` : ''}
        </Txt>
        <Txt muted size={12} center>
          Added by {nameOf(e.created_by)} {timeAgo(e.created_at)}
          {e.updated_at !== e.created_at && e.updated_by ? `\nUpdated by ${nameOf(e.updated_by)} ${timeAgo(e.updated_at)}` : ''}
        </Txt>
      </Card>

      {payment && from && to ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Avatar name={nameOf(from.profile_id, { you: false })} seed={from.profile_id} size={52} />
            <Txt weight="600">{nameOf(from.profile_id)}</Txt>
          </View>
          <Ionicons name="arrow-forward" size={28} color={c.brand} />
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Avatar name={nameOf(to.profile_id, { you: false })} seed={to.profile_id} size={52} />
            <Txt weight="600">{nameOf(to.profile_id)}</Txt>
          </View>
        </Card>
      ) : (
        <Card padded={false}>
          {[...e.shares]
            .sort((a, b) => b.paid - a.paid)
            .map((s, i) => {
              const parts: string[] = [];
              if (s.paid > 0) parts.push(`paid ${formatMoney(s.paid, e.currency)}`);
              if (s.owed > 0) parts.push(`${s.paid > 0 ? 'and ' : ''}owe${nameOf(s.profile_id) === 'You' ? '' : 's'} ${formatMoney(s.owed, e.currency)}`);
              if (parts.length === 0) parts.push('not involved');
              return (
                <Fragment key={s.profile_id}>
                  {i > 0 ? <Divider inset={68} /> : null}
                  <Row left={<Avatar name={nameOf(s.profile_id, { you: false })} seed={s.profile_id} />} title={nameOf(s.profile_id)} subtitle={parts.join(' ')} />
                </Fragment>
              );
            })}
        </Card>
      )}

      {e.notes ? (
        <Card style={{ gap: 6 }}>
          <Txt size={13} weight="700" muted>NOTES</Txt>
          <Txt>{e.notes}</Txt>
        </Card>
      ) : null}

      <Button
        title={payment ? 'Edit payment' : 'Edit expense'}
        icon="create-outline"
        variant="secondary"
        onPress={() =>
          payment ? router.push({ pathname: '/settle', params: { editId: e.id } }) : router.push({ pathname: '/expense/new', params: { editId: e.id } })
        }
      />
      <Button title="Delete" icon="trash-outline" variant="danger" onPress={remove} loading={deleting} />
    </Screen>
  );
}
