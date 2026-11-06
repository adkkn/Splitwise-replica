import { View } from 'react-native';

import { Txt } from '@/components/ui';
import { useColors } from '@/lib/theme';

export default function NotConfigured() {
  const c = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
      <Txt size={22} weight="800">Almost there</Txt>
      <Txt muted center>
        This build has no database connected yet. Add your Supabase URL and key (see the README), then build again.
      </Txt>
    </View>
  );
}
