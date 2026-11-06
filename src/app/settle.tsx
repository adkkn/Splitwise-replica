import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Fragment, useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { CurrencyPicker } from '@/components/pickers';
import { Avatar, Button, Card, Divider, Row, Screen, SectionTitle, Sheet, Txt, showError } from '@/components/ui';
import { useData, useFriendList, type Profile } from '@/lib/data';
import { todayISO } from '@/lib/dates';
import { currencyInfo, formatMoney, parseAmount, type Debt, type Expense } from '@/lib/money';
import { errorMessage } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

export default function Settle() {
  const params = useLocalSearchParams<{ friendId?: string; groupId?: string; editId?: string }>();
  const { me, debts, groupsById, expensesById } = useData();
  const editing = params.editId ? expensesById.get(params.editId) : undefined;

  const options = useMemo(() => {
    if (!me || editing) return [];
    return debts
      .filter((d) => {
        if (params.groupId) return d.groupId === params.groupId;
        const mine = d.from === me.id || d.to === me.id;
        if (params.friendId) return mine && (d.from === params.friendId || d.to === params.friendId);
        return mine;
      })
      .sort((a, b) => (a.from === me.id ? -1 : 0) - (b.from === me.id ? -1 : 0) || b.cents - a.cents);
  }, [debts, me, params.groupId, params.friendId, editing]);

  if (!me) return null;
  if (params.editId && !editing) return null;

  // Initial state: an existing payment, the first suggested debt, or a blank payment from me.
  let init: { from: string; to: string; amountText: string; currency: string; groupId: string | null; selected: number | null };
  if (editing) {
    init = {
      from: editing.shares.find((s) => s.paid > 0)?.profile_id ?? me.id,
      to: editing.shares.find((s) => s.owed > 0)?.profile_id ?? '',
      amountText: (editing.amount / 100).toFixed(2),
      currency: editing.currency,
      groupId: editing.group_id,
      selected: null,
    };
  } else if (options.length > 0) {
    const d = options[0];
    init = { from: d.from, to: d.to, amountText: (d.cents / 100).toFixed(2), currency: d.currency, groupId: d.groupId, selected: 0 };
  } else {
    const g = params.groupId ? groupsById.get(params.groupId) : undefined;
    init = {
      from: me.id,
      to: params.friendId ?? '',
      amountText: '',
      currency: g?.currency ?? me.default_currency ?? 'AED',
      groupId: params.groupId ?? null,
      selected: null,
    };
  }
  return <SettleForm me={me} options={options} editing={editing} init={init} />;
}

function SettleForm({
  me,
  options,
  editing,
  init,
}: {
  me: Profile;
  options: Debt[];
  editing?: Expense;
  init: { from: string; to: string; amountText: string; currency: string; groupId: string | null; selected: number | null };
}) {
  const c = useColors();
  const nav = useNavigation();
  const { groupsById, nameOf, actions } = useData();
  const friendList = useFriendList();

  const [from, setFrom] = useState<string>(init.from);
  const [to, setTo] = useState<string>(init.to);
  const [amountText, setAmountText] = useState(init.amountText);
  const [currency, setCurrency] = useState(init.currency);
  const [groupId, setGroupId] = useState<string | null>(init.groupId);
  const [selected, setSelected] = useState<number | null>(init.selected);
  const [sheet, setSheet] = useState<null | 'from' | 'to' | 'currency'>(null);
  const [saving, setSaving] = useState(false);

  function pick(d: Debt, i: number) {
    setSelected(i);
    setFrom(d.from);
    setTo(d.to);
    setAmountText((d.cents / 100).toFixed(2));
    setCurrency(d.currency);
    setGroupId(d.groupId);
  }

  useLayoutEffect(() => {
    nav.setOptions({ title: editing ? 'Edit payment' : 'Settle up' });
  }, [nav, editing]);

  const group = groupId ? groupsById.get(groupId) : undefined;
  const candidates = useMemo(() => {
    if (group) return group.memberIds;
    return [me.id, ...friendList];
  }, [group, friendList, me]);

  const amount = parseAmount(amountText) ?? 0;

  async function save() {
    if (!from || !to) return showError('Choose who paid and who received.');
    if (from === to) return showError('The payer and the receiver must be different people.');
    if (amount <= 0) return showError('Enter an amount.');
    setSaving(true);
    try {
      await actions.saveExpense({
        id: editing?.id ?? null,
        groupId,
        description: 'Payment',
        amount,
        currency,
        category: 'general',
        splitType: 'payment',
        isPayment: true,
        date: editing?.date ?? todayISO(),
        notes: null,
        shares: [
          { profile_id: from, paid: amount, owed: 0 },
          { profile_id: to, paid: 0, owed: amount },
        ],
      });
      router.back();
    } catch (e) {
      showError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const personButton = (id: string, which: 'from' | 'to') => (
    <Pressable onPress={() => setSheet(which)} style={{ alignItems: 'center', gap: 6, flex: 1 }}>
      {id ? (
        <Avatar name={nameOf(id, { you: false })} seed={id} size={60} />
      ) : (
        <View style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderStyle: 'dashed', borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={26} color={c.textMuted} />
        </View>
      )}
      <Txt weight="700" numberOfLines={1}>{id ? nameOf(id) : 'Choose'}</Txt>
      <Txt size={12} muted>{which === 'from' ? 'paid' : 'received'}</Txt>
    </Pressable>
  );

  return (
    <Screen footer={<Button title={editing ? 'Save payment' : 'Record payment'} icon="checkmark" onPress={save} loading={saving} />}>
      {options.length > 0 ? (
        <>
          <SectionTitle>Suggested</SectionTitle>
          <Card padded={false}>
            {options.map((d, i) => {
              const g = d.groupId ? groupsById.get(d.groupId) : undefined;
              const sel = selected === i;
              const text = d.from === me.id ? `You pay ${nameOf(d.to)}` : d.to === me.id ? `${nameOf(d.from)} pays you` : `${nameOf(d.from)} pays ${nameOf(d.to, { you: false })}`;
              return (
                <Fragment key={`${d.from}-${d.to}-${d.currency}-${d.groupId}`}>
                  {i > 0 ? <Divider inset={16} /> : null}
                  <Row
                    title={text}
                    subtitle={g ? `in ${g.name}` : 'outside of groups'}
                    onPress={() => pick(d, i)}
                    right={
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Txt weight="700" color={d.from === me.id ? c.owe : c.owed}>{formatMoney(d.cents, d.currency)}</Txt>
                        <Ionicons name={sel ? 'radio-button-on' : 'radio-button-off'} size={22} color={sel ? c.brand : c.textMuted} />
                      </View>
                    }
                  />
                </Fragment>
              );
            })}
          </Card>
        </>
      ) : !editing ? (
        <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Ionicons name="checkmark-circle" size={24} color={c.owed} />
          <Txt style={{ flex: 1 }}>All settled up here. You can still record any payment below.</Txt>
        </Card>
      ) : null}

      <SectionTitle>Payment</SectionTitle>
      <Card style={{ gap: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {personButton(from, 'from')}
          <Pressable
            hitSlop={10}
            onPress={() => {
              setFrom(to);
              setTo(from);
              setSelected(null);
            }}>
            <Ionicons name="swap-horizontal" size={28} color={c.brand} />
          </Pressable>
          {personButton(to, 'to')}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={() => setSheet('currency')}
            style={{ width: 56, height: 56, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardAlt }}>
            <Txt size={11} weight="800">{currency}</Txt>
            <Txt size={14}>{currencyInfo(currency).flag}</Txt>
          </Pressable>
          <TextInput
            value={amountText}
            onChangeText={(t) => {
              setAmountText(t);
              setSelected(null);
            }}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={c.textMuted}
            style={{ flex: 1, fontSize: 34, fontWeight: '800', color: c.text, borderBottomWidth: 2, borderColor: c.border, paddingVertical: 4 }}
          />
        </View>
        <Txt size={13} muted center>{group ? `Recorded in ${group.name}` : 'Recorded outside of groups'}</Txt>
      </Card>

      <Sheet visible={sheet === 'from' || sheet === 'to'} onClose={() => setSheet(null)} title={sheet === 'from' ? 'Who paid?' : 'Who received?'}>
        <Card padded={false}>
          {candidates.map((id, i) => (
            <Fragment key={id}>
              {i > 0 ? <Divider inset={68} /> : null}
              <Row
                left={<Avatar name={nameOf(id, { you: false })} seed={id} />}
                title={nameOf(id)}
                right={(sheet === 'from' ? from : to) === id ? <Ionicons name="checkmark-circle" size={22} color={c.brand} /> : null}
                onPress={() => {
                  if (sheet === 'from') setFrom(id);
                  else setTo(id);
                  setSelected(null);
                  setSheet(null);
                }}
              />
            </Fragment>
          ))}
        </Card>
      </Sheet>
      <CurrencyPicker visible={sheet === 'currency'} value={currency} onChange={setCurrency} onClose={() => setSheet(null)} />
    </Screen>
  );
}
