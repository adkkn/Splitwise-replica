import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useState } from 'react';
import { View } from 'react-native';

import { CurrencyPicker, PeoplePicker } from '@/components/pickers';
import { Avatar, Button, Card, Chip, Divider, Field, Row, Screen, SectionTitle, ToggleRow, Txt, confirm, showError } from '@/components/ui';
import { useData, useFriendList, type Group, type Profile } from '@/lib/data';
import { currencyInfo, myTotals } from '@/lib/money';
import { errorMessage } from '@/lib/supabase';
import { GROUP_KINDS, useColors } from '@/lib/theme';

export default function GroupSettings() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me, groupsById } = useData();
  const group = groupsById.get(id);
  if (!group || !me) return null;
  return <SettingsForm group={group} me={me} key={`${group.id}:${group.name}:${group.kind}:${group.currency}`} />;
}

function SettingsForm({ group, me }: { group: Group; me: Profile }) {
  const c = useColors();
  const id = group.id;
  const { profiles, debts, nameOf, actions } = useData();
  const friendList = useFriendList();
  const [name, setName] = useState(group.name);
  const [kind, setKind] = useState(group.kind);
  const [currency, setCurrency] = useState(group.currency);
  const [sheet, setSheet] = useState<null | 'people' | 'currency'>(null);
  const [busy, setBusy] = useState(false);
  const dirty = name.trim() !== group.name || kind !== group.kind || currency !== group.currency;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      showError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const save = () => run(() => actions.updateGroup(id, { name, currency, kind, simplify: group.simplify_debts }));

  return (
    <Screen>
      <Card style={{ gap: 14 }}>
        <Field label="Group name" value={name} onChangeText={setName} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {GROUP_KINDS.map((k) => (
            <Chip key={k.key} label={k.label} icon={k.icon} selected={kind === k.key} onPress={() => setKind(k.key)} />
          ))}
        </View>
        <Button variant="secondary" title={`${currencyInfo(currency).flag}  Main currency: ${currency}`} onPress={() => setSheet('currency')} />
        {dirty ? <Button title="Save" onPress={save} loading={busy} /> : null}
      </Card>

      <Card padded={false}>
        <ToggleRow
          title="Simplify group debts"
          subtitle="Combines debts so everyone pays as few people as possible. Totals stay the same."
          value={group.simplify_debts}
          onChange={(v) => run(() => actions.updateGroup(id, { name: group.name, currency: group.currency, kind: group.kind, simplify: v }))}
        />
      </Card>

      <SectionTitle right={<Button title="Add" icon="person-add-outline" variant="ghost" small onPress={() => setSheet('people')} />}>
        {`Members (${group.memberIds.length})`}
      </SectionTitle>
      <Card padded={false}>
        {group.memberIds.map((pid, i) => (
          <Fragment key={pid}>
            {i > 0 ? <Divider inset={68} /> : null}
            <Row
              left={<Avatar name={nameOf(pid, { you: false })} seed={pid} />}
              title={nameOf(pid, { you: false }) + (pid === me.id ? ' (you)' : '')}
              subtitle={profiles.get(pid)?.email}
              right={
                pid !== me.id ? (
                  <Ionicons name="remove-circle-outline" size={22} color={c.danger} />
                ) : null
              }
              onPress={
                pid !== me.id
                  ? async () => {
                      if (await confirm('Remove from group?', `${nameOf(pid)} will be removed. Only possible when their balance here is zero.`, 'Remove', true))
                        run(() => actions.removeGroupMember(id, pid));
                    }
                  : undefined
              }
            />
          </Fragment>
        ))}
      </Card>

      <SectionTitle>Danger zone</SectionTitle>
      <Button
        title="Leave group"
        icon="exit-outline"
        variant="danger"
        onPress={async () => {
          if (myTotals(debts, me.id, id).size > 0) return showError('Settle up your balance in this group before leaving.');
          if (!(await confirm('Leave group?', 'You will no longer see this group.', 'Leave', true))) return;
          run(async () => {
            await actions.removeGroupMember(id, me.id);
            router.dismissTo('/groups');
          });
        }}
      />
      <Button
        title="Delete group"
        icon="trash-outline"
        variant="danger"
        onPress={async () => {
          if (!(await confirm('Delete group?', 'This deletes the group and ALL its expenses for everyone. This cannot be undone.', 'Delete', true))) return;
          run(async () => {
            await actions.deleteGroup(id);
            router.dismissTo('/groups');
          });
        }}
      />
      <Txt size={12} muted center>Group created by {nameOf(group.created_by)}</Txt>

      <PeoplePicker
        visible={sheet === 'people'}
        title="Add members"
        candidates={friendList.filter((f) => !group.memberIds.includes(f))}
        selected={[]}
        onChange={(ids) => {
          const added = ids.filter((x) => !group.memberIds.includes(x));
          if (added.length) run(async () => {
            for (const pid of added) await actions.addGroupMember(id, pid);
          });
        }}
        onClose={() => setSheet(null)}
      />
      <CurrencyPicker visible={sheet === 'currency'} value={currency} onChange={setCurrency} onClose={() => setSheet(null)} />
    </Screen>
  );
}
