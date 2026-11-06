import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import { Fragment, useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';

import { ErrorView, OverallSummary } from '@/components/summary';
import { Avatar, Button, Card, Divider, EmptyState, Fab, Loading, Row, Screen, Segmented, TotalsText, Txt } from '@/components/ui';
import { useData, useFriendList } from '@/lib/data';
import { balanceWith, myTotals } from '@/lib/money';
import { useColors } from '@/lib/theme';

export default function Friends() {
  const c = useColors();
  const nav = useNavigation();
  const { me, profiles, debts, loading, refresh, error } = useData();
  const friends = useFriendList();
  const [filter, setFilter] = useState<'all' | 'owe' | 'owed'>('all');
  const [refreshing, setRefreshing] = useState(false);

  useLayoutEffect(() => {
    nav.setOptions({
      headerRight: () => (
        <Pressable onPress={() => router.push('/friend/add')} hitSlop={10} style={{ marginRight: 16 }}>
          <Ionicons name="person-add-outline" size={22} color={c.brand} />
        </Pressable>
      ),
    });
  }, [nav, c]);

  const rows = useMemo(() => {
    if (!me) return [];
    return friends
      .map((id) => ({ id, name: profiles.get(id)?.name ?? 'Someone', email: profiles.get(id)?.email ?? '', totals: balanceWith(debts, me.id, id) }))
      .filter((r) => {
        if (filter === 'all') return true;
        const vals = [...r.totals.values()];
        return filter === 'owe' ? vals.some((v) => v < 0) : vals.some((v) => v > 0);
      })
      .sort((a, b) => {
        const ab = a.totals.size > 0 ? 0 : 1;
        const bb = b.totals.size > 0 ? 0 : 1;
        return ab - bb || a.name.localeCompare(b.name);
      });
  }, [friends, profiles, debts, me, filter]);

  if (loading && !me) return error ? <ErrorView message={error} onRetry={refresh} /> : <Loading />;

  const total = me ? myTotals(debts, me.id) : new Map();

  return (
    <View style={{ flex: 1 }}>
      <Screen
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={c.brand}
            onRefresh={async () => {
              setRefreshing(true);
              await refresh();
              setRefreshing(false);
            }}
          />
        }>
        <OverallSummary totals={total} />
        {friends.length > 0 ? (
          <Segmented
            options={[
              { key: 'all', label: 'All' },
              { key: 'owed', label: 'Owe you' },
              { key: 'owe', label: 'You owe' },
            ]}
            value={filter}
            onChange={setFilter}
          />
        ) : null}
        {friends.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No friends yet"
            text="Add a friend by email to start splitting. They can join later with the same email."
            action={<Button title="Add a friend" icon="person-add" onPress={() => router.push('/friend/add')} style={{ marginTop: 8 }} />}
          />
        ) : (
          <Card padded={false}>
            {rows.map((r, i) => (
              <Fragment key={r.id}>
                {i > 0 ? <Divider inset={68} /> : null}
                <Row
                  onPress={() => router.push({ pathname: '/friend/[id]', params: { id: r.id } })}
                  left={<Avatar name={r.name} seed={r.id} size={42} />}
                  title={r.name}
                  subtitle={r.email}
                  right={<TotalsText totals={r.totals} align="right" owedLabel="owes you" oweLabel="you owe" settledLabel="settled up" />}
                />
              </Fragment>
            ))}
            {rows.length === 0 ? <Txt muted center style={{ padding: 20 }}>Nobody here.</Txt> : null}
          </Card>
        )}
        <View style={{ height: 70 }} />
      </Screen>
      <Fab onPress={() => router.push('/expense/new')} />
    </View>
  );
}
