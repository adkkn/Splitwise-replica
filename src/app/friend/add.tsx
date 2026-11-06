import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Card, Field, Screen, Txt, showError } from '@/components/ui';
import { useData } from '@/lib/data';
import { errorMessage } from '@/lib/supabase';

export default function AddFriend() {
  const { actions } = useData();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!email.trim()) return showError('Enter their email address.');
    setSaving(true);
    try {
      const id = await actions.addFriend(email.trim(), name.trim() || undefined);
      router.replace({ pathname: '/friend/[id]', params: { id } });
    } catch (e) {
      showError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Card style={{ gap: 14 }}>
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="friend@example.com" autoCapitalize="none" keyboardType="email-address" autoFocus />
        <Field label="Name (optional)" value={name} onChangeText={setName} placeholder="What you call them" autoCapitalize="words" />
        <Txt size={13} muted>
          They do not need the app yet. When they sign up with this email, they will see everything you have split with them.
        </Txt>
        <Button title="Add friend" icon="person-add" onPress={save} loading={saving} />
      </Card>
    </Screen>
  );
}
