// Your Supabase project details. Find them in Supabase: Project Settings > API Keys / Data API.
// The publishable (anon) key is meant to be public: the database rules in supabase/schema.sql
// make sure people only ever see their own data.
// They can also be set with the EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY env vars.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://kyewrnhltzmgalphuqbu.supabase.co';
export const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY || 'sb_publishable_cyILftyfyFYuiNgAIM1GPw_tiaUm--k';

// Links shown on the "Invite friends" button. Filled in automatically by the build.
export const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_URL || '';
export const APK_URL = process.env.EXPO_PUBLIC_APK_URL || '';

export const APP_NAME = 'Evenly';
export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);
