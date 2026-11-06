import { useState } from 'react';
import { Platform, Share, View } from 'react-native';

import { CurrencyPicker } from '@/components/pickers';
import { Avatar, Button, Card, Divider, Field, Row, SectionTitle, Screen, Segmented, Txt, confirm, showError } from '@/components/ui';
import { APK_URL, APP_NAME, WEB_APP_URL } from '@/config';
import { useData, type Profile } from '@/lib/data';
import { currencyInfo } from '@/lib/money';
import { errorMessage } from '@/lib/supabase';
import { useThemePref, type ThemePref } from '@/lib/theme';

export default function Account() {
  const { me } = useData();
  if (!me) return null;
  return <AccountForm me={me} key={`${me.id}:${me.name}:${me.default_currency}`} />;
}

function AccountForm({ me }: { me: Profile }) {
  const { actions } = useData();
  const { pref, setPref } = useThemePref();
  const [name, setName] = useState(me.name);
  const [currency, setCurrency] = useState(me.default_currency);
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = name.trim() !== me.name || currency !== me.default_currency;

  async function save() {
    setSaving(true);
    try {
      await actions.updateProfile(name, currency);
    } catch (e) {
      showError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function invite() {
    const lines = [`Join me on ${APP_NAME} to split bills.`];
    if (APK_URL) lines.push(`Android app: ${APK_URL}`);
    if (WEB_APP_URL) lines.push(`iPhone (open in Safari, then Share > Add to Home Screen): ${WEB_APP_URL}`);
    lines.push('Sign up with the email I added you with, so our expenses show up.');
    const message = lines.join('\n');
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
        if ((navigator as any).share) await (navigator as any).share({ text: message });
        else {
          await navigator.clipboard.writeText(message);
          showError('Invite message copied. Paste it in WhatsApp or anywhere.', 'Copied');
        }
      } else {
        await Share.share({ message });
      }
    } catch {
      // user cancelled
    }
  }

  return (
    <Screen>
      <Card style={{ alignItems: 'center', gap: 8 }}>
        <Avatar name={me.name} seed={me.id} size={72} />
        <Txt size={20} weight="800">{me.name}</Txt>
        <Txt muted>{me.email}</Txt>
      </Card>

      <SectionTitle>Profile</SectionTitle>
      <Card style={{ gap: 12 }}>
        <Field label="Name" value={name} onChangeText={setName} />
        <View style={{ gap: 6 }}>
          <Txt size={13} weight="600" muted>Default currency</Txt>
          <Button variant="secondary" title={`${currencyInfo(currency).flag}  ${currency} · ${currencyInfo(currency).name}`} onPress={() => setPicker(true)} />
        </View>
        {dirty ? <Button title="Save changes" onPress={save} loading={saving} /> : null}
      </Card>

      <SectionTitle>Appearance</SectionTitle>
      <Segmented<ThemePref>
        options={[
          { key: 'system', label: 'Auto' },
          { key: 'light', label: 'Light' },
          { key: 'dark', label: 'Dark' },
        ]}
        value={pref}
        onChange={setPref}
      />

      <SectionTitle>Friends</SectionTitle>
      <Card padded={false}>
        <Row title="Invite friends" subtitle="Share the app link" onPress={invite} chevron />
        <Divider inset={16} />
        <Row
          title="Log out"
          onPress={async () => {
            if (await confirm('Log out?', 'You can log back in any time.', 'Log out', true)) actions.signOut();
          }}
          chevron
        />
      </Card>
      <Txt size={12} muted center style={{ marginTop: 12 }}>{APP_NAME} · made for friends</Txt>
      <CurrencyPicker visible={picker} value={currency} onClose={() => setPicker(false)} onChange={setCurrency} />
    </Screen>
  );
}
