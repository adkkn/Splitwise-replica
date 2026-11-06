import { View } from 'react-native';

import { Button, Card, EmptyState, Screen, TotalsText, Txt } from '@/components/ui';
import { addTo, type Totals } from '@/lib/money';
import { useColors } from '@/lib/theme';

export function OverallSummary({ totals }: { totals: Totals }) {
  const c = useColors();
  const owed: Totals = new Map();
  const owe: Totals = new Map();
  for (const [cur, v] of totals) addTo(v > 0 ? owed : owe, cur, v);
  return (
    <Card style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Txt size={12} muted weight="600">YOU ARE OWED</Txt>
        {owed.size === 0 ? <Txt size={20} weight="800" color={c.textMuted}>0.00</Txt> : <TotalsText totals={owed} owedLabel="" size={18} />}
      </View>
      <View style={{ width: 1, backgroundColor: c.border }} />
      <View style={{ flex: 1, gap: 4 }}>
        <Txt size={12} muted weight="600">YOU OWE</Txt>
        {owe.size === 0 ? <Txt size={20} weight="800" color={c.textMuted}>0.00</Txt> : <TotalsText totals={owe} oweLabel="" size={18} />}
      </View>
    </Card>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Screen>
      <EmptyState icon="cloud-offline-outline" title="Could not load" text={message} action={<Button title="Try again" onPress={onRetry} />} />
    </Screen>
  );
}
