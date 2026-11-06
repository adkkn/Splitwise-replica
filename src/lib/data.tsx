import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { isConfigured } from '@/config';
import { computeDebts, fromCents, toCents, type Debt, type Expense, type Share } from '@/lib/money';
import { errorMessage, supabase } from '@/lib/supabase';

export type Profile = {
  id: string;
  user_id: string | null;
  email: string;
  name: string;
  default_currency: string;
};

export type Group = {
  id: string;
  name: string;
  kind: string;
  currency: string;
  simplify_debts: boolean;
  created_by: string | null;
  created_at: string;
  memberIds: string[];
};

export type Activity = {
  id: number;
  actor_id: string | null;
  kind: string;
  group_id: string | null;
  group_name: string | null;
  expense_id: string | null;
  description: string | null;
  amount: number | null; // cents
  currency: string | null;
  involved: string[];
  created_at: string;
};

type AuthCtx = { session: Session | null; ready: boolean };
const AuthContext = createContext<AuthCtx>({ session: null, ready: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!isConfigured);

  useEffect(() => {
    if (!isConfigured) return;
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setReady(true));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    // Keep the login fresh while the app is open, pause it in the background.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => {
      data.subscription.unsubscribe();
      sub.remove();
    };
  }, []);

  return <AuthContext.Provider value={{ session, ready }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export type SaveExpenseInput = {
  id?: string | null;
  groupId: string | null;
  description: string;
  amount: number; // cents
  currency: string;
  category: string;
  splitType: string;
  isPayment: boolean;
  date: string; // YYYY-MM-DD
  notes: string | null;
  shares: Share[]; // cents
};

type DataCtx = {
  loading: boolean;
  error: string | null;
  me: Profile | null;
  profiles: Map<string, Profile>;
  friendIds: string[];
  groups: Group[];
  groupsById: Map<string, Group>;
  expenses: Expense[];
  expensesById: Map<string, Expense>;
  debts: Debt[];
  activity: Activity[];
  refresh: () => Promise<void>;
  nameOf: (id: string | null | undefined, opts?: { you?: boolean }) => string;
  actions: {
    addFriend: (email: string, name?: string) => Promise<string>;
    removeFriend: (id: string) => Promise<void>;
    createGroup: (name: string, currency: string, kind: string, memberIds: string[]) => Promise<string>;
    updateGroup: (id: string, patch: { name: string; currency: string; kind: string; simplify: boolean }) => Promise<void>;
    addGroupMember: (groupId: string, profileId: string) => Promise<void>;
    removeGroupMember: (groupId: string, profileId: string) => Promise<void>;
    deleteGroup: (id: string) => Promise<void>;
    saveExpense: (input: SaveExpenseInput) => Promise<string>;
    deleteExpense: (id: string) => Promise<void>;
    updateProfile: (name: string, currency: string) => Promise<void>;
    signOut: () => Promise<void>;
  };
};

const DataContext = createContext<DataCtx | null>(null);

/** Fresh data state for every signed in user (everything resets on log out). */
export function UserDataProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  return <DataProvider key={session?.user.id ?? 'signed-out'}>{children}</DataProvider>;
}

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await build(from, from + page - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < page) break;
  }
  return out;
}

async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const loadingRef = useRef<Promise<void> | null>(null);
  const againRef = useRef(false);

  const load = useCallback(async () => {
    if (!session) return;
    const name = (session.user.user_metadata?.name as string | undefined) ?? null;
    const meRes = await supabase.rpc('ensure_profile', { p_name: name });
    if (meRes.error) throw new Error(meRes.error.message);
    const myProfile = meRes.data as Profile;

    const [profRows, friendRows, groupRows, memberRows, expenseRows, activityRes] = await Promise.all([
      fetchAll<Profile>((a, b) => supabase.from('profiles').select('id,user_id,email,name,default_currency').range(a, b)),
      fetchAll<{ friend_id: string }>((a, b) => supabase.from('friendships').select('friend_id').range(a, b)),
      fetchAll<Omit<Group, 'memberIds'>>((a, b) => supabase.from('groups').select('*').order('created_at').range(a, b)),
      fetchAll<{ group_id: string; profile_id: string }>((a, b) =>
        supabase.from('group_members').select('group_id,profile_id').order('created_at').range(a, b),
      ),
      fetchAll<any>((a, b) =>
        supabase
          .from('expenses')
          .select('*, expense_shares(profile_id, paid, owed)')
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
          .range(a, b),
      ),
      supabase.from('activity').select('*').order('id', { ascending: false }).limit(300),
    ]);
    if (activityRes.error) throw new Error(activityRes.error.message);

    const pmap = new Map(profRows.map((p) => [p.id, p]));
    pmap.set(myProfile.id, myProfile);

    const membersByGroup = new Map<string, string[]>();
    for (const m of memberRows) {
      const arr = membersByGroup.get(m.group_id) ?? [];
      arr.push(m.profile_id);
      membersByGroup.set(m.group_id, arr);
    }

    setMe(myProfile);
    setProfiles(pmap);
    setFriendIds(friendRows.map((f) => f.friend_id));
    setGroups(groupRows.map((g) => ({ ...g, memberIds: membersByGroup.get(g.id) ?? [] })));
    setExpenses(
      expenseRows.map((e) => ({
        ...e,
        amount: toCents(e.amount),
        shares: (e.expense_shares ?? []).map((s: any) => ({ profile_id: s.profile_id, paid: toCents(s.paid), owed: toCents(s.owed) })),
      })),
    );
    setActivity(
      (activityRes.data ?? []).map((a: any) => ({ ...a, amount: a.amount == null ? null : toCents(a.amount), involved: a.involved ?? [] })),
    );
    setError(null);
  }, [session]);

  // Coalesces many refresh requests (e.g. bursts of live updates) into at most one extra load.
  const refresh = useCallback(async () => {
    if (loadingRef.current) {
      againRef.current = true;
      return loadingRef.current;
    }
    const run = (async () => {
      try {
        do {
          againRef.current = false;
          await load();
        } while (againRef.current);
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setLoading(false);
        loadingRef.current = null;
      }
    })();
    loadingRef.current = run;
    return run;
  }, [load]);

  useEffect(() => {
    if (!session) return;
    refresh();

    let timer: ReturnType<typeof setTimeout> | null = null;
    const soon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => refresh(), 400);
    };
    const channel = supabase.channel('evenly-changes');
    for (const table of ['expenses', 'expense_shares', 'groups', 'group_members', 'friendships', 'activity', 'profiles']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, soon);
    }
    channel.subscribe();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') soon();
    });
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
      sub.remove();
    };
  }, [session, refresh]);

  const value = useMemo<DataCtx>(() => {
    const groupsById = new Map(groups.map((g) => [g.id, g]));
    const expensesById = new Map(expenses.map((e) => [e.id, e]));
    const debts = computeDebts(expenses, new Map(groups.map((g) => [g.id, g.simplify_debts])));

    const nameOf: DataCtx['nameOf'] = (id, opts) => {
      if (!id) return 'Someone';
      if (me && id === me.id && opts?.you !== false) return 'You';
      return profiles.get(id)?.name ?? 'Someone';
    };

    const after = async <T,>(p: Promise<T>) => {
      const r = await p;
      await refresh();
      return r;
    };

    return {
      loading,
      error,
      me,
      profiles,
      friendIds,
      groups,
      groupsById,
      expenses,
      expensesById,
      debts,
      activity,
      refresh,
      nameOf,
      actions: {
        addFriend: (email, name) => after(rpc<string>('add_friend', { p_email: email, p_name: name ?? null })),
        removeFriend: (id) => after(rpc<void>('remove_friend', { p_friend: id })),
        createGroup: (name, currency, kind, memberIds) =>
          after(rpc<string>('create_group', { p_name: name, p_currency: currency, p_kind: kind, p_member_ids: memberIds })),
        updateGroup: (id, p) =>
          after(rpc<void>('update_group', { p_group: id, p_name: p.name, p_currency: p.currency, p_kind: p.kind, p_simplify: p.simplify })),
        addGroupMember: (g, p) => after(rpc<void>('add_group_member', { p_group: g, p_profile: p })),
        removeGroupMember: (g, p) => after(rpc<void>('remove_group_member', { p_group: g, p_profile: p })),
        deleteGroup: (id) => after(rpc<void>('delete_group', { p_group: id })),
        saveExpense: (i) =>
          after(
            rpc<string>('save_expense', {
              p_id: i.id ?? null,
              p_group: i.groupId,
              p_description: i.description,
              p_amount: fromCents(i.amount),
              p_currency: i.currency,
              p_category: i.category,
              p_split_type: i.splitType,
              p_is_payment: i.isPayment,
              p_date: i.date,
              p_notes: i.notes,
              p_shares: i.shares
                .filter((s) => s.paid > 0 || s.owed > 0)
                .map((s) => ({ profile_id: s.profile_id, paid: fromCents(s.paid), owed: fromCents(s.owed) })),
            }),
          ),
        deleteExpense: (id) => after(rpc<void>('delete_expense', { p_id: id })),
        updateProfile: (name, currency) => after(rpc<void>('update_my_profile', { p_name: name, p_default_currency: currency })),
        signOut: async () => {
          await supabase.auth.signOut();
        },
      },
    };
  }, [loading, error, me, profiles, friendIds, groups, expenses, activity, refresh]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataCtx {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}

/** Everyone I should see on the Friends tab: friends plus anyone I have a balance with. */
export function useFriendList() {
  const { friendIds, debts, me } = useData();
  return useMemo(() => {
    const set = new Set(friendIds);
    if (me) {
      for (const d of debts) {
        if (d.from === me.id) set.add(d.to);
        if (d.to === me.id) set.add(d.from);
      }
      set.delete(me.id);
    }
    return [...set];
  }, [friendIds, debts, me]);
}
