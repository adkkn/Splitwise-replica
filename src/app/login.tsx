import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Field, Segmented, Txt, showError } from '@/components/ui';
import { APP_NAME } from '@/config';
import { errorMessage, supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

export default function Login() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  async function submit() {
    setInfo(null);
    const e = email.trim().toLowerCase();
    if (!e || !password) return showError('Please enter your email and password.');
    if (mode === 'signup' && !name.trim()) return showError('Please enter your name.');
    if (mode === 'signup' && password.length < 6) return showError('Use at least 6 characters for your password.');
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: e, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email: e, password, options: { data: { name: name.trim() } } });
        if (error) throw error;
        if (!data.session) setInfo('Check your inbox to confirm your email, then sign in.');
      }
    } catch (err) {
      const msg = errorMessage(err);
      showError(msg === 'Invalid login credentials' ? 'Wrong email or password.' : msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: insets.top + 24, gap: 14, maxWidth: 480, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Image source={require('@/assets/images/icon.png')} style={{ width: 88, height: 88, borderRadius: 24 }} />
          <Txt size={32} weight="800">{APP_NAME}</Txt>
          <Txt muted center>Split bills with friends. Free, forever.</Txt>
        </View>

        <Segmented
          options={[
            { key: 'signin', label: 'Log in' },
            { key: 'signup', label: 'Sign up' },
          ]}
          value={mode}
          onChange={(m) => setMode(m)}
        />

        {mode === 'signup' ? <Field label="Your name" value={name} onChangeText={setName} placeholder="e.g. Ahmed" autoCapitalize="words" /> : null}
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 6 characters" secureTextEntry autoComplete={mode === 'signin' ? 'password' : 'new-password'} onSubmitEditing={submit} />

        {info ? (
          <View style={{ backgroundColor: c.brandSoft, padding: 12, borderRadius: 12 }}>
            <Txt color={c.brand} weight="600">{info}</Txt>
          </View>
        ) : null}

        <Button title={mode === 'signin' ? 'Log in' : 'Create account'} onPress={submit} loading={busy} style={{ marginTop: 6 }} />
        {mode === 'signup' ? (
          <Txt size={13} muted center>
            If a friend already added you by email, sign up with that same email and everything they added shows up.
          </Txt>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
