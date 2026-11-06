import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Loading } from '@/components/ui';
import { isConfigured } from '@/config';
import { AuthProvider, UserDataProvider, useAuth } from '@/lib/data';
import { AppThemeProvider, useColors } from '@/lib/theme';
import NotConfigured from '@/components/not-configured';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootStack() {
  const c = useColors();
  const { session, ready } = useAuth();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  const navTheme = c.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = {
    ...navTheme,
    colors: { ...navTheme.colors, primary: c.brand, background: c.bg, card: c.card, text: c.text, border: c.border },
  };

  if (!isConfigured) return <NotConfigured />;
  if (!ready) return <Loading />;

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={c.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.card },
          headerTintColor: c.text,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.bg },
          headerBackButtonDisplayMode: 'minimal',
        }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="friend/[id]" options={{ title: '' }} />
          <Stack.Screen name="friend/add" options={{ title: 'Add friend', presentation: 'modal' }} />
          <Stack.Screen name="group/[id]/index" options={{ title: '' }} />
          <Stack.Screen name="group/[id]/settings" options={{ title: 'Group settings' }} />
          <Stack.Screen name="group/new" options={{ title: 'New group', presentation: 'modal' }} />
          <Stack.Screen name="expense/new" options={{ title: 'Add expense', presentation: 'modal' }} />
          <Stack.Screen name="expense/[id]" options={{ title: 'Details' }} />
          <Stack.Screen name="settle" options={{ title: 'Settle up', presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <AuthProvider>
        <UserDataProvider>
          <RootStack />
        </UserDataProvider>
      </AuthProvider>
    </AppThemeProvider>
  );
}
