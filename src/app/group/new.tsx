import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Fragment, useState } from 'react';
import { View } from 'react-native';

import { CurrencyPicker, PeoplePicker } from '@/components/pickers';
import { Avatar, Button, Card, Chip, Divider, Field, Row, Screen, SectionTitle, Txt, showError } from '@/components/ui';
import { useData, useFriendList } from '@/lib/data';
import { currencyInfo } from '@/lib/money';
import { errorMessage } from '@/lib/supabase';
import { GROUP_KINDS, useColors } from '@/lib/theme';

export default function NewGroup() {
  const c = useColors();
  const { me, nameOf, actions } = useData();
  const friendList = useFriendList();
  const [name, setName] = useState('');
  const [kind, setKind] = useState('trip');
  const [currency, setCurrency] = useState(me?.default_currency ?? 'AED');
  const [members, setMembers] = useState<string[]>([]);
  const [sheet, setSheet] = useState<null | 'people' | 'currency'>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return showError('Give your group a name.');
    setSaving(true);
    try {
      const id = await actions.createGroup(name.trim(), currency, kind, members);
      router.replace({ pathname: '/group/[id]', params: { id } });
    } catch (e) {
      showError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen footer={<Button title="Create group" icon="checkmark" onPress={save} loading={saving} />}>
      <Card style={{ gap: 14 }}>
        <Field label="Group name" value={name} onChangeText={setName} placeholder="e.g. Ireland trip" autoFocus />
        <View style={{ gap: 6 }}>
          <Txt size={13} weight="600" muted>Type</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {GROUP_KINDS.map((k) => (
              <Chip key={k.key} label={k.label} icon={k.icon} selected={kind === k.key} onPress={() => setKind(k.key)} />
            ))}
          </View>
        </View>
        <View style={{ gap: 6 }}>
          <Txt size={13} weight="600" muted>Main currency (you can still use any currency per expense)</Txt>
          <Button variant="secondary" title={`${currencyInfo(currency).flag}  ${currency} · ${currencyInfo(currency).name}`} onPress={() => setSheet('currency')} />
        </View>
      </Card>

      <SectionTitle right={<Button title="Add" icon="person-add-outline" variant="ghost" small onPress={() => setSheet('people')} />}>Members</SectionTitle>
      <Card padded={false}>
        {me ? <Row left={<Avatar name={me.name} seed={me.id} />} title={`${me.name} (you)`} /> : null}
        {members.map((id) => (
          <Fragment key={id}>
            <Divider inset={68} />
            <Row
              left={<Avatar name={nameOf(id, { you: false })} seed={id} />}
              title={nameOf(id)}
              right={<Ionicons name="close-circle" size={22} color={c.textMuted} />}
              onPress={() => setMembers(members.filter((m) => m !== id))}
            />
          </Fragment>
        ))}
      </Card>

      <PeoplePicker visible={sheet === 'people'} title="Add members" candidates={friendList} selected={members} onChange={setMembers} onClose={() => setSheet(null)} />
      <CurrencyPicker visible={sheet === 'currency'} value={currency} onChange={setCurrency} onClose={() => setSheet(null)} />
    </Screen>
  );
}
