import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

const light = {
  scheme: 'light' as 'light' | 'dark',
  bg: '#F4F6F8',
  card: '#FFFFFF',
  cardAlt: '#F0F3F5',
  text: '#16202A',
  textMuted: '#6B7785',
  border: '#E3E8EC',
  brand: '#12A887',
  brandDark: '#0B7F66',
  brandSoft: '#DDF5EE',
  onBrand: '#FFFFFF',
  owed: '#12A887', // you are owed: green
  owe: '#E8692C', // you owe: orange
  oweSoft: '#FDEBE1',
  danger: '#D93B3B',
  inputBg: '#FFFFFF',
  shadow: 'rgba(16, 32, 48, 0.08)',
};

const dark: typeof light = {
  scheme: 'dark',
  bg: '#0E1418',
  card: '#172026',
  cardAlt: '#1E2A31',
  text: '#ECF1F4',
  textMuted: '#93A1AD',
  border: '#26333B',
  brand: '#27C29E',
  brandDark: '#1FA585',
  brandSoft: '#14332C',
  onBrand: '#06130F',
  owed: '#3AD0AA',
  owe: '#FF8A50',
  oweSoft: '#3A2418',
  danger: '#FF6B6B',
  inputBg: '#121A1F',
  shadow: 'rgba(0, 0, 0, 0.4)',
};

export type Colors = typeof light;
export type ThemePref = 'system' | 'light' | 'dark';

type Ctx = { colors: Colors; pref: ThemePref; setPref: (p: ThemePref) => void };
const ThemeCtx = createContext<Ctx>({ colors: light, pref: 'system', setPref: () => {} });

const KEY = 'evenly.theme';

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setPrefState(v);
      })
      .catch(() => {});
  }, []);

  const value = useMemo<Ctx>(() => {
    const scheme = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
    return {
      colors: scheme === 'dark' ? dark : light,
      pref,
      setPref: (p) => {
        setPrefState(p);
        AsyncStorage.setItem(KEY, p).catch(() => {});
      },
    };
  }, [pref, system]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useColors = () => useContext(ThemeCtx).colors;
export const useThemePref = () => useContext(ThemeCtx);

const AVATAR_COLORS = ['#12A887', '#3B82F6', '#8B5CF6', '#E8692C', '#EC4899', '#0EA5E9', '#F59E0B', '#10B981', '#6366F1', '#EF4444'];

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export type IconName = React.ComponentProps<typeof import('@expo/vector-icons').Ionicons>['name'];

export const CATEGORIES: { key: string; label: string; icon: IconName; color: string }[] = [
  { key: 'general', label: 'General', icon: 'receipt-outline', color: '#64748B' },
  { key: 'food', label: 'Food & dining', icon: 'restaurant-outline', color: '#E8692C' },
  { key: 'groceries', label: 'Groceries', icon: 'cart-outline', color: '#16A34A' },
  { key: 'drinks', label: 'Drinks', icon: 'beer-outline', color: '#D97706' },
  { key: 'coffee', label: 'Coffee', icon: 'cafe-outline', color: '#92400E' },
  { key: 'transport', label: 'Transport', icon: 'car-outline', color: '#2563EB' },
  { key: 'fuel', label: 'Fuel', icon: 'speedometer-outline', color: '#0891B2' },
  { key: 'flights', label: 'Flights', icon: 'airplane-outline', color: '#0EA5E9' },
  { key: 'hotel', label: 'Hotel', icon: 'bed-outline', color: '#7C3AED' },
  { key: 'rent', label: 'Rent', icon: 'home-outline', color: '#0F766E' },
  { key: 'utilities', label: 'Utilities', icon: 'flash-outline', color: '#CA8A04' },
  { key: 'shopping', label: 'Shopping', icon: 'bag-handle-outline', color: '#DB2777' },
  { key: 'entertainment', label: 'Fun', icon: 'film-outline', color: '#9333EA' },
  { key: 'sports', label: 'Sports', icon: 'football-outline', color: '#059669' },
  { key: 'gifts', label: 'Gifts', icon: 'gift-outline', color: '#E11D48' },
  { key: 'health', label: 'Health', icon: 'medkit-outline', color: '#DC2626' },
];

export function categoryInfo(key: string) {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0];
}

export const GROUP_KINDS: { key: string; label: string; icon: IconName }[] = [
  { key: 'trip', label: 'Trip', icon: 'airplane' },
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'couple', label: 'Couple', icon: 'heart' },
  { key: 'other', label: 'Other', icon: 'people' },
];

export function groupKindInfo(key: string) {
  return GROUP_KINDS.find((k) => k.key === key) ?? GROUP_KINDS[3];
}

const CATEGORY_WORDS: [string, RegExp][] = [
  ['drinks', /\b(pub|bar|beer|beers|pint|pints|wine|drinks?|cocktails?|guinness|club)\b/i],
  ['coffee', /\b(coffee|cafe|café|starbucks|latte|tea)\b/i],
  ['food', /\b(dinner|lunch|breakfast|brunch|food|restaurant|pizza|burger|kfc|mcdonalds|shawarma|meal|snacks?|takeaway|talabat|deliveroo|sushi)\b/i],
  ['groceries', /\b(groceries|grocery|supermarket|carrefour|lulu|tesco|lidl|aldi|spinneys|market)\b/i],
  ['transport', /\b(taxi|uber|careem|bolt|bus|train|metro|tram|luas|parking|toll|salik|car rental|rental car|transport)\b/i],
  ['fuel', /\b(fuel|petrol|gas|diesel|adnoc|enoc)\b/i],
  ['flights', /\b(flights?|plane|airline|emirates|ryanair|aer lingus|etihad|flydubai|airport)\b/i],
  ['hotel', /\b(hotel|airbnb|hostel|booking|accommodation|stay|resort)\b/i],
  ['rent', /\b(rent|deposit)\b/i],
  ['utilities', /\b(electricity|dewa|water|internet|wifi|etisalat|bill|utilities)\b/i],
  ['entertainment', /\b(movie|movies|cinema|concert|tickets?|show|netflix|spotify|game|games|museum|tour)\b/i],
  ['sports', /\b(gym|football|padel|tennis|golf|sports?|match)\b/i],
  ['shopping', /\b(shopping|clothes|mall|amazon|noon|ikea)\b/i],
  ['gifts', /\b(gift|gifts|present|birthday)\b/i],
  ['health', /\b(pharmacy|doctor|medicine|hospital|clinic)\b/i],
];

/** Guesses a category from the description, like "Taxi to airport" -> transport. */
export function guessCategory(description: string): string | null {
  for (const [key, re] of CATEGORY_WORDS) if (re.test(description)) return key;
  return null;
}
