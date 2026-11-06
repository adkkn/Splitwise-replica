import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { SUPABASE_KEY, SUPABASE_URL, isConfigured } from '@/config';

export const supabase = createClient(
  isConfigured ? SUPABASE_URL : 'https://not-configured.supabase.co',
  isConfigured ? SUPABASE_KEY : 'not-configured',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  },
);

/** Turns any thrown value into a friendly message. */
export function errorMessage(e: unknown): string {
  if (!e) return 'Something went wrong';
  if (typeof e === 'string') return e;
  const m = (e as { message?: string }).message;
  return m || 'Something went wrong';
}
