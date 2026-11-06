import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import { Fragment, useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';

import { OverallSummary } from '@/components/summary';
import { Button, Card, Divider, EmptyState, Fab, IconBadge, Loading, Screen, TotalsText, Txt } from '@/components/ui';
import { useData } from '@/lib/data';
import { formatMoney, myTotals } from '@/lib/money';
import { groupKindInfo, useColors } from '@/lib/theme';

export default function Groups() {
  const c = useColors();
  const nav = useNavigation();
  const { me, groups, debts, loading, refresh, nameOf } = useData();
  const [refreshing, setRefreshing] = useState(false);

  useLayoutEffect(() => {
    nav.setOptions({
      headerRight: () => (
        <Pressable onPress={() => router.push('/group/new')} hitSlop={10} style={{ marginRight: 16 }}>
          <Ionicons name="add-circle-outline" size={26} color={c.brand} />
        </Pressable>
      ),
    });
  }, [nav, c]);

  const rows = useMemo(() => {
    if (!me) return [];
    return groups
      .map((g) => {
        const totals = myTotals(debts, me.id, g.id);
        const lines = debts
          .filter((d) => d.groupId === g.id && (d.from === me.id || d.to === me.id))
          .slice(0, 3)
          .map((d) =>
            d.to === me.id
              ? { text: `${nameOf(d.from)} owes you ${formatMoney(d.cents, d.currency)}`, color: c.owed }
              : { text: `You owe ${nameOf(d.to)} ${formatMoney(d.cents, d.currency)}`, color: c.owe },
          );
        return { g, totals, lines };
      })
      .sort((a, b) => b.g.created_at.localeCompare(a.g.created_at));
  }, [groups, debts, me, nameOf, c]);

  if (loading && !me) return <Loading />;

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
        {me ? <OverallSummary totals={myTotals(debts, me.id)} /> : null}
        {groups.length === 0 ? (
          <EmptyState
            icon="people-circle-outline"
            title="No groups yet"
            text="Make a group for a trip, your flat, or anything you share regularly."
            action={<Button title="Start a group" icon="add" onPress={() => router.push('/group/new')} style={{ marginTop: 8 }} />}
          />
        ) : (
          <Card padded={false}>
            {rows.map(({ g, totals, lines }, i) => (
              <Fragment key={g.id}>
                {i > 0 ? <Divider inset={80} /> : null}
                <Pressable
                  onPress={() => router.push({ pathname: '/group/[id]', params: { id: g.id } })}
                  style={({ pressed }) => [{ flexDirection: 'row', padding: 14, gap: 14, alignItems: 'center' }, pressed && { backgroundColor: c.cardAlt }]}>
                  <IconBadge icon={groupKindInfo(g.kind).icon} color={c.brand} size={52} rounded={16} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Txt size={17} weight="700" numberOfLines={1}>{g.name}</Txt>
                    <TotalsText totals={totals} size={13} />
                    {lines.map((l, k) => (
                      <Txt key={k} size={12} color={l.color} numberOfLines={1}>{l.text}</Txt>
                    ))}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
                </Pressable>
              </Fragment>
            ))}
          </Card>
        )}
        <View style={{ height: 70 }} />
      </Screen>
      <Fab onPress={() => router.push('/expense/new')} />
    </View>
  );
}
