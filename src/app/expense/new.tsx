import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Fragment, useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { CategoryPicker, CurrencyPicker, GroupPicker, PeoplePicker } from '@/components/pickers';
import {
  Avatar,
  Button,
  Card,
  CategoryIcon,
  Chip,
  Divider,
  Field,
  Row,
  Screen,
  Segmented,
  Sheet,
  Txt,
  showError,
} from '@/components/ui';
import { useData, useFriendList, type Profile } from '@/lib/data';
import { addDays, prettyDate, todayISO } from '@/lib/dates';
import { currencyInfo, formatMoney, parseAmount, splitByWeights, type Expense, type Share } from '@/lib/money';
import { errorMessage } from '@/lib/supabase';
import { guessCategory, useColors } from '@/lib/theme';

type SplitType = 'equal' | 'exact' | 'percent' | 'shares';

const SPLIT_LABEL: Record<SplitType, string> = {
  equal: 'equally',
  exact: 'by exact amounts',
  percent: 'by percentages',
  shares: 'by shares',
};

function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(/\.00$/, '');
}

type Init = {
  groupId: string | null;
  others: string[];
  description: string;
  amountText: string;
  currency: string;
  category: string;
  date: string;
  notes: string;
  multiPay: boolean;
  payer: string;
  paidText: Record<string, string>;
  splitType: SplitType;
  excluded: string[];
  splitText: Record<string, string>;
};

export default function AddExpense() {
  const params = useLocalSearchParams<{ groupId?: string; friendId?: string; editId?: string }>();
  const { me, groupsById, expensesById } = useData();
  if (!me) return null;
  const editing = params.editId ? expensesById.get(params.editId) : undefined;
  if (params.editId && !editing) return null;

  let init: Init;
  if (editing) {
    const payers = editing.shares.filter((s) => s.paid > 0);
    const equal = editing.split_type === 'equal';
    init = {
      groupId: editing.group_id,
      others: editing.shares.map((s) => s.profile_id).filter((id) => id !== me.id),
      description: editing.description,
      amountText: centsToInput(editing.amount),
      currency: editing.currency,
      category: editing.category,
      date: editing.date,
      notes: editing.notes ?? '',
      multiPay: payers.length !== 1,
      payer: payers.length === 1 ? payers[0].profile_id : me.id,
      paidText: Object.fromEntries(editing.shares.map((s) => [s.profile_id, s.paid ? centsToInput(s.paid) : ''])),
      // Percent and share splits are reopened as exact amounts, which keeps every cent identical.
      splitType: equal ? 'equal' : 'exact',
      excluded: equal ? editing.shares.filter((s) => s.owed === 0).map((s) => s.profile_id) : [],
      splitText: equal ? {} : Object.fromEntries(editing.shares.map((s) => [s.profile_id, s.owed ? centsToInput(s.owed) : ''])),
    };
  } else {
    init = {
      groupId: params.groupId ?? null,
      others: params.friendId ? [params.friendId] : [],
      description: '',
      amountText: '',
      currency: (params.groupId && groupsById.get(params.groupId)?.currency) || me.default_currency || 'AED',
      category: 'general',
      date: todayISO(),
      notes: '',
      multiPay: false,
      payer: me.id,
      paidText: {},
      splitType: 'equal',
      excluded: [],
      splitText: {},
    };
  }
  return <ExpenseForm init={init} me={me} editing={editing} />;
}

function ExpenseForm({ init, me, editing }: { init: Init; me: Profile; editing?: Expense }) {
  const c = useColors();
  const nav = useNavigation();
  const { groupsById, nameOf, actions } = useData();
  const friendList = useFriendList();

  const [groupId, setGroupId] = useState<string | null>(init.groupId);
  const [others, setOthers] = useState<string[]>(init.others);
  const [description, setDescription] = useState(init.description);
  const [amountText, setAmountText] = useState(init.amountText);
  const [currency, setCurrency] = useState(init.currency);
  const [category, setCategory] = useState(init.category);
  const [categoryPicked, setCategoryPicked] = useState(Boolean(editing));
  const [date, setDate] = useState(init.date);
  const [notes, setNotes] = useState(init.notes);

  const [multiPay, setMultiPay] = useState(init.multiPay);
  const [payer, setPayer] = useState<string>(init.payer);
  const [paidText, setPaidText] = useState<Record<string, string>>(init.paidText);

  const [splitType, setSplitType] = useState<SplitType>(init.splitType);
  const [excluded, setExcluded] = useState<string[]>(init.excluded);
  const [splitText, setSplitText] = useState<Record<string, string>>(init.splitText);

  const [sheet, setSheet] = useState<null | 'people' | 'group' | 'currency' | 'category' | 'payer' | 'split'>(null);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    nav.setOptions({ title: editing ? 'Edit expense' : 'Add expense' });
  }, [nav, editing]);

  const group = groupId ? groupsById.get(groupId) : undefined;
  const people = useMemo(() => {
    if (group) return [...group.memberIds].sort((a, b) => (a === me.id ? -1 : b === me.id ? 1 : 0));
    return [me.id, ...others.filter((o) => o !== me.id)];
  }, [group, others, me]);

  const amount = parseAmount(amountText) ?? 0;

  const computed = useMemo((): { shares: Share[]; error: string | null; info: string | null } => {
    const shares = new Map<string, Share>(people.map((id) => [id, { profile_id: id, paid: 0, owed: 0 }]));
    if (amount <= 0) return { shares: [...shares.values()], error: 'Enter an amount', info: null };

    // Who paid
    if (multiPay) {
      let sum = 0;
      for (const id of people) {
        const v = parseAmount(paidText[id] ?? '') ?? 0;
        shares.get(id)!.paid = v;
        sum += v;
      }
      if (sum !== amount) {
        const diff = amount - sum;
        return {
          shares: [...shares.values()],
          error: `Paid amounts ${diff > 0 ? 'are short by' : 'are over by'} ${formatMoney(Math.abs(diff), currency)}`,
          info: null,
        };
      }
    } else {
      if (!shares.has(payer)) return { shares: [...shares.values()], error: 'Choose who paid', info: null };
      shares.get(payer)!.paid = amount;
    }

    // How it is split
    if (splitType === 'equal') {
      const ids = people.filter((id) => !excluded.includes(id));
      if (ids.length === 0) return { shares: [...shares.values()], error: 'Pick at least one person to split with', info: null };
      splitByWeights(amount, ids.map(() => 1)).forEach((v, i) => (shares.get(ids[i])!.owed = v));
      return { shares: [...shares.values()], error: null, info: `${formatMoney(Math.floor(amount / ids.length), currency)}/person` };
    }
    if (splitType === 'exact') {
      let sum = 0;
      for (const id of people) {
        const v = parseAmount(splitText[id] ?? '') ?? 0;
        shares.get(id)!.owed = v;
        sum += v;
      }
      const left = amount - sum;
      return {
        shares: [...shares.values()],
        error: left !== 0 ? `${formatMoney(Math.abs(left), currency)} ${left > 0 ? 'left to assign' : 'too much'}` : null,
        info: `${formatMoney(sum, currency)} of ${formatMoney(amount, currency)}`,
      };
    }
    const weights = people.map((id) => {
      const n = parseFloat((splitText[id] ?? '').replace(',', '.'));
      return isFinite(n) && n > 0 ? n : 0;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    if (splitType === 'percent') {
      if (Math.abs(total - 100) > 0.001) {
        return { shares: [...shares.values()], error: `${(100 - total).toFixed(2).replace(/\.00$/, '')}% left to assign`, info: null };
      }
    } else if (total <= 0) {
      return { shares: [...shares.values()], error: 'Give at least one person a share', info: null };
    }
    splitByWeights(amount, weights.map((w) => Math.round(w * 1000))).forEach((v, i) => (shares.get(people[i])!.owed = v));
    return { shares: [...shares.values()], error: null, info: splitType === 'percent' ? '100%' : `${total} shares` };
  }, [people, amount, multiPay, paidText, payer, splitType, excluded, splitText, currency]);

  async function save() {
    if (!description.trim()) return showError('Add a description, like "Dinner".');
    if (amount <= 0) return showError('Enter an amount.');
    if (people.length < 2) return showError('Choose who you split this with.');
    if (computed.error) return showError(computed.error);
    setSaving(true);
    try {
      await actions.saveExpense({
        id: editing?.id ?? null,
        groupId,
        description: description.trim(),
        amount,
        currency,
        category,
        splitType,
        isPayment: false,
        date,
        notes: notes.trim() || null,
        shares: computed.shares,
      });
      router.back();
    } catch (e) {
      showError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const payerLabel = multiPay ? `${people.filter((id) => (parseAmount(paidText[id] ?? '') ?? 0) > 0).length || 'multiple'} people` : nameOf(payer);

  return (
    <Screen footer={<Button title={editing ? 'Save changes' : 'Save expense'} icon="checkmark" onPress={save} loading={saving} />}>
      {/* Who and where */}
      <Card padded={false}>
        <Row
          left={<Ionicons name="people-outline" size={22} color={c.brand} />}
          title={
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <Txt weight="600">With you and:</Txt>
              {people
                .filter((id) => id !== me.id)
                .map((id) => (
                  <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.brandSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Avatar name={nameOf(id, { you: false })} seed={id} size={18} />
                    <Txt size={13} weight="600" color={c.brand}>{nameOf(id, { you: false })}</Txt>
                  </View>
                ))}
              {people.length < 2 ? <Txt muted>tap to choose</Txt> : null}
            </View>
          }
          onPress={group ? undefined : () => setSheet('people')}
          chevron={!group}
        />
        <Divider inset={50} />
        <Row
          left={<Ionicons name="albums-outline" size={22} color={c.brand} />}
          title={group ? group.name : 'No group'}
          subtitle={group ? 'Everyone in the group can see this' : 'Only the people involved can see this'}
          onPress={() => setSheet('group')}
          chevron
        />
      </Card>

      {/* What and how much */}
      <Card style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => setSheet('category')}>
            <CategoryIcon category={category} size={52} />
          </Pressable>
          <TextInput
            value={description}
            onChangeText={(t) => {
              setDescription(t);
              if (!categoryPicked) setCategory(guessCategory(t) ?? 'general');
            }}
            placeholder="Enter a description"
            placeholderTextColor={c.textMuted}
            style={{ flex: 1, fontSize: 18, color: c.text, borderBottomWidth: 2, borderColor: c.border, paddingVertical: 8 }}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            onPress={() => setSheet('currency')}
            style={{ width: 52, height: 52, borderRadius: 12, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardAlt }}>
            <Txt size={11} weight="800">{currency}</Txt>
            <Txt size={14}>{currencyInfo(currency).flag}</Txt>
          </Pressable>
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            placeholder="0.00"
            placeholderTextColor={c.textMuted}
            keyboardType="decimal-pad"
            style={{ flex: 1, fontSize: 32, fontWeight: '800', color: c.text, borderBottomWidth: 2, borderColor: c.border, paddingVertical: 4 }}
          />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 4 }}>
          <Txt>Paid by</Txt>
          <Chip label={payerLabel} selected onPress={() => setSheet('payer')} />
          <Txt>and split</Txt>
          <Chip label={SPLIT_LABEL[splitType]} selected onPress={() => setSheet('split')} />
        </View>
        {amount > 0 ? (
          <Txt size={13} center color={computed.error ? c.owe : c.textMuted}>
            {computed.error ?? computed.info}
          </Txt>
        ) : null}
      </Card>

      {/* Extras */}
      <Card padded={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6 }}>
          <Ionicons name="calendar-outline" size={22} color={c.brand} style={{ marginHorizontal: 4 }} />
          <Pressable hitSlop={8} onPress={() => setDate(addDays(date, -1))} style={{ padding: 8 }}>
            <Ionicons name="chevron-back" size={20} color={c.text} />
          </Pressable>
          <Txt weight="600" style={{ flex: 1, textAlign: 'center' }}>{prettyDate(date)}</Txt>
          <Pressable hitSlop={8} onPress={() => setDate(addDays(date, 1))} style={{ padding: 8 }} disabled={date >= todayISO()}>
            <Ionicons name="chevron-forward" size={20} color={date >= todayISO() ? c.border : c.text} />
          </Pressable>
        </View>
        <Divider />
        <View style={{ padding: 12 }}>
          <Field placeholder="Notes (optional)" value={notes} onChangeText={setNotes} multiline style={{ minHeight: 44 }} />
        </View>
      </Card>

      {/* Sheets */}
      <PeoplePicker
        visible={sheet === 'people'}
        title="Split with"
        candidates={friendList}
        selected={others}
        onChange={setOthers}
        onClose={() => setSheet(null)}
      />
      <GroupPicker
        visible={sheet === 'group'}
        value={groupId}
        onClose={() => setSheet(null)}
        onChange={(g) => {
          setGroupId(g);
          setExcluded([]);
          if (g) {
            if (!editing) setCurrency(groupsById.get(g)?.currency ?? currency);
          } else {
            setOthers([]);
          }
          if (!g || !groupsById.get(g)?.memberIds.includes(payer)) setPayer(me.id);
        }}
      />
      <CurrencyPicker visible={sheet === 'currency'} value={currency} onChange={setCurrency} onClose={() => setSheet(null)} />
      <CategoryPicker
        visible={sheet === 'category'}
        value={category}
        onChange={(k) => {
          setCategory(k);
          setCategoryPicked(true);
        }}
        onClose={() => setSheet(null)}
      />

      <Sheet visible={sheet === 'payer'} onClose={() => setSheet(null)} title="Who paid?" footer={multiPay ? <Button title="Done" onPress={() => setSheet(null)} /> : undefined}>
        <Card padded={false}>
          {people.map((id, i) => (
            <Fragment key={id}>
              {i > 0 ? <Divider inset={68} /> : null}
              <Row
                left={<Avatar name={nameOf(id, { you: false })} seed={id} />}
                title={nameOf(id)}
                onPress={
                  multiPay
                    ? undefined
                    : () => {
                        setPayer(id);
                        setSheet(null);
                      }
                }
                right={
                  multiPay ? (
                    <AmountInput value={paidText[id] ?? ''} onChange={(v) => setPaidText((p) => ({ ...p, [id]: v }))} prefix={currencyInfo(currency).symbol} />
                  ) : payer === id ? (
                    <Ionicons name="checkmark-circle" size={24} color={c.brand} />
                  ) : null
                }
              />
            </Fragment>
          ))}
          <Divider />
          <Row
            left={<Ionicons name={multiPay ? 'checkbox' : 'square-outline'} size={24} color={c.brand} />}
            title="Multiple people paid"
            onPress={() => {
              if (!multiPay) setPaidText(Object.fromEntries(people.map((id) => [id, id === payer && amount ? centsToInput(amount) : ''])));
              setMultiPay(!multiPay);
            }}
          />
        </Card>
        {multiPay && amount > 0 ? (
          <Txt center color={computed.error?.startsWith('Paid') ? c.owe : c.owed} weight="600">
            {computed.error?.startsWith('Paid') ? computed.error : 'Amounts add up'}
          </Txt>
        ) : null}
      </Sheet>

      <Sheet visible={sheet === 'split'} onClose={() => setSheet(null)} title="Split options" footer={<Button title="Done" onPress={() => setSheet(null)} />}>
        <Segmented<SplitType>
          options={[
            { key: 'equal', label: '=' },
            { key: 'exact', label: '1.23' },
            { key: 'percent', label: '%' },
            { key: 'shares', label: 'Shares' },
          ]}
          value={splitType}
          onChange={(t) => {
            setSplitType(t);
            if (t === 'percent') setSplitText(Object.fromEntries(people.map((id) => [id, ''])));
            if (t === 'shares') setSplitText(Object.fromEntries(people.map((id) => [id, '1'])));
            if (t === 'exact') setSplitText(Object.fromEntries(computed.shares.map((s) => [s.profile_id, s.owed ? centsToInput(s.owed) : ''])));
          }}
        />
        <Txt muted size={13} center>
          {
            {
              equal: 'Select which people owe an equal share.',
              exact: 'Specify exactly how much each person owes.',
              percent: 'Enter the percentage split that is fair for your situation.',
              shares: 'Great for time based splitting (2 nights to 3) and for family shares.',
            }[splitType]
          }
        </Txt>
        <Card padded={false}>
          {people.map((id, i) => {
            const owed = computed.shares.find((s) => s.profile_id === id)?.owed ?? 0;
            const inSplit = !excluded.includes(id);
            return (
              <Fragment key={id}>
                {i > 0 ? <Divider inset={68} /> : null}
                <Row
                  left={<Avatar name={nameOf(id, { you: false })} seed={id} />}
                  title={nameOf(id)}
                  subtitle={splitType !== 'exact' && owed ? formatMoney(owed, currency) : undefined}
                  onPress={splitType === 'equal' ? () => setExcluded((x) => (inSplit ? [...x, id] : x.filter((y) => y !== id))) : undefined}
                  right={
                    splitType === 'equal' ? (
                      <Ionicons name={inSplit ? 'checkbox' : 'square-outline'} size={24} color={inSplit ? c.brand : c.textMuted} />
                    ) : (
                      <AmountInput
                        value={splitText[id] ?? ''}
                        onChange={(v) => setSplitText((p) => ({ ...p, [id]: v }))}
                        prefix={splitType === 'exact' ? currencyInfo(currency).symbol : undefined}
                        suffix={splitType === 'percent' ? '%' : splitType === 'shares' ? 'share(s)' : undefined}
                      />
                    )
                  }
                />
              </Fragment>
            );
          })}
        </Card>
        {amount > 0 ? (
          <Txt center weight="600" color={computed.error && !computed.error.startsWith('Paid') ? c.owe : c.owed}>
            {computed.error && !computed.error.startsWith('Paid') ? computed.error : computed.info}
          </Txt>
        ) : (
          <Txt center muted>Enter the total amount first.</Txt>
        )}
      </Sheet>
    </Screen>
  );
}

function AmountInput({ value, onChange, prefix, suffix }: { value: string; onChange: (v: string) => void; prefix?: string; suffix?: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {prefix ? <Txt muted size={14}>{prefix.trim()}</Txt> : null}
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={c.textMuted}
        style={{ width: 80, textAlign: 'right', fontSize: 16, color: c.text, borderBottomWidth: 1.5, borderColor: c.border, paddingVertical: 4 }}
      />
      {suffix ? <Txt muted size={13}>{suffix}</Txt> : null}
    </View>
  );
}
