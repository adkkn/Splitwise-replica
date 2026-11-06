import { Ionicons } from '@expo/vector-icons';
import { useMemo, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatMoney, type Totals } from '@/lib/money';
import { avatarColor, categoryInfo, useColors, type IconName } from '@/lib/theme';

// ---------- Cross platform dialogs (Alert does not support buttons on web) ----------

export function showError(message: string, title = 'Oops') {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

export function confirm(title: string, message: string, okLabel = 'OK', destructive = false): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: okLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]),
  );
}

// ---------- Text ----------

type TxtProps = {
  children?: ReactNode;
  style?: StyleProp<TextStyle>;
  muted?: boolean;
  size?: number;
  weight?: '400' | '500' | '600' | '700' | '800';
  color?: string;
  numberOfLines?: number;
  center?: boolean;
};

export function Txt({ children, style, muted, size = 15, weight = '400', color, numberOfLines, center }: TxtProps) {
  const c = useColors();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        { color: color ?? (muted ? c.textMuted : c.text), fontSize: size, fontWeight: weight, textAlign: center ? 'center' : undefined },
        style,
      ]}>
      {children}
    </Text>
  );
}

// ---------- Layout ----------

export function Screen({
  children,
  scroll = true,
  padded = true,
  refreshControl,
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  refreshControl?: React.ReactElement<any>;
  footer?: ReactNode;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const inner = { padding: padded ? 16 : 0, paddingBottom: 32 + (footer ? 0 : insets.bottom), gap: 12 };
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.webWidth}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={inner}
            keyboardShouldPersistTaps="handled"
            refreshControl={refreshControl}
            style={{ flex: 1 }}>
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, inner]}>{children}</View>
        )}
        {footer ? <View style={{ padding: 16, paddingBottom: 16 + insets.bottom, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.card }}>{footer}</View> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const c = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: c.card,
          borderRadius: 16,
          padding: padded ? 16 : 0,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: c.border,
          overflow: 'hidden',
        },
        style,
      ]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 4 }}>
      <Txt size={13} weight="700" muted style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {children}
      </Txt>
      {right}
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: inset }} />;
}

export function Row({
  left,
  title,
  subtitle,
  right,
  onPress,
  subtitleColor,
  chevron,
}: {
  left?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  subtitleColor?: string;
  chevron?: boolean;
}) {
  const c = useColors();
  const rowStyle: ViewStyle = { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 12 };
  const content = (
    <>
      {left}
      <View style={{ flex: 1, gap: 2 }}>
        {typeof title === 'string' ? (
          <Txt size={16} weight="600" numberOfLines={1}>
            {title}
          </Txt>
        ) : (
          title
        )}
        {subtitle ? (
          typeof subtitle === 'string' ? (
            <Txt size={13} muted={!subtitleColor} color={subtitleColor} numberOfLines={2}>
              {subtitle}
            </Txt>
          ) : (
            subtitle
          )
        ) : null}
      </View>
      {right}
      {chevron ? <Ionicons name="chevron-forward" size={18} color={c.textMuted} /> : null}
    </>
  );
  // A row without an action is a plain view, so inputs inside it stay interactive.
  if (!onPress) return <View style={rowStyle}>{content}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [rowStyle, pressed && { backgroundColor: c.cardAlt }]}>
      {content}
    </Pressable>
  );
}

// ---------- Avatars and icons ----------

export function Avatar({ name, seed, size = 40 }: { name: string; seed: string; size?: number }) {
  const initials = useMemo(() => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const s = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2);
    return s.toUpperCase();
  }, [name]);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(seed), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  );
}

export function IconBadge({ icon, color, size = 40, rounded = 12 }: { icon: IconName; color: string; size?: number; rounded?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: rounded, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size * 0.52} color={color} />
    </View>
  );
}

export function CategoryIcon({ category, size = 40, isPayment }: { category: string; size?: number; isPayment?: boolean }) {
  const c = useColors();
  if (isPayment) return <IconBadge icon="cash-outline" color={c.brand} size={size} />;
  const info = categoryInfo(category);
  return <IconBadge icon={info.icon} color={info.color} size={size} />;
}

// ---------- Buttons and inputs ----------

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
  small,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'orange';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const c = useColors();
  const palette = {
    primary: { bg: c.brand, fg: c.onBrand, border: c.brand },
    orange: { bg: c.owe, fg: '#fff', border: c.owe },
    secondary: { bg: c.card, fg: c.text, border: c.border },
    ghost: { bg: 'transparent', fg: c.brand, border: 'transparent' },
    danger: { bg: 'transparent', fg: c.danger, border: c.danger },
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: 1,
          borderRadius: 12,
          paddingVertical: small ? 8 : 13,
          paddingHorizontal: small ? 12 : 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.fg} size="small" />
      ) : icon ? (
        <Ionicons name={icon} size={small ? 16 : 18} color={palette.fg} />
      ) : null}
      <Text style={{ color: palette.fg, fontWeight: '700', fontSize: small ? 14 : 16 }}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Txt size={13} weight="600" muted>
          {label}
        </Txt>
      ) : null}
      <TextInput
        placeholderTextColor={c.textMuted}
        {...props}
        style={[
          {
            backgroundColor: c.inputBg,
            borderColor: c.border,
            borderWidth: 1,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: Platform.OS === 'ios' ? 13 : 10,
            fontSize: 16,
            color: c.text,
          },
          style,
        ]}
      />
    </View>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? c.brand : c.border,
        backgroundColor: selected ? c.brandSoft : c.card,
      }}>
      {icon ? <Ionicons name={icon} size={15} color={selected ? c.brand : c.textMuted} /> : null}
      <Txt size={14} weight="600" color={selected ? c.brand : c.text}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.cardAlt, borderRadius: 12, padding: 3 }}>
      {options.map((o) => {
        const sel = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: sel ? c.card : 'transparent' }}>
            <Txt size={13} weight={sel ? '700' : '500'} color={sel ? c.text : c.textMuted}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({ title, subtitle, value, onChange }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void }) {
  const c = useColors();
  return (
    <Row
      title={title}
      subtitle={subtitle}
      right={<Switch value={value} onValueChange={onChange} trackColor={{ true: c.brand, false: c.border }} thumbColor="#fff" />}
    />
  );
}

// ---------- Sheets ----------

export function Sheet({ visible, onClose, title, children, footer }: { visible: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View
            style={{
              maxHeight: height * 0.88,
              width: '100%',
              maxWidth: 640,
              alignSelf: 'center',
              backgroundColor: c.bg,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              paddingBottom: insets.bottom + 8,
            }}>
            <View style={{ alignItems: 'center', paddingTop: 8 }}>
              <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.border }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
              <Txt size={18} weight="700" style={{ flex: 1 }}>
                {title}
              </Txt>
              <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
                <Ionicons name="close-circle" size={28} color={c.textMuted} />
              </Pressable>
            </View>
            <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 10 }} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
            {footer ? <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>{footer}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ---------- Money ----------

/** "you are owed €10.00" / "you owe AED 5.00" lines for a set of totals. */
export function TotalsText({
  totals,
  size = 14,
  owedLabel = 'you are owed',
  oweLabel = 'you owe',
  settledLabel = 'settled up',
  align,
}: {
  totals: Totals;
  size?: number;
  owedLabel?: string;
  oweLabel?: string;
  settledLabel?: string;
  align?: 'left' | 'right';
}) {
  const c = useColors();
  const entries = [...totals].filter(([, v]) => v !== 0);
  if (entries.length === 0) {
    return (
      <Txt size={size} muted style={{ textAlign: align }}>
        {settledLabel}
      </Txt>
    );
  }
  return (
    <View style={{ alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
      {entries.map(([cur, v]) => (
        <View key={cur} style={{ alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
          {align === 'right' ? (
            <>
              <Txt size={11} color={v > 0 ? c.owed : c.owe}>
                {v > 0 ? owedLabel : oweLabel}
              </Txt>
              <Txt size={size + 1} weight="700" color={v > 0 ? c.owed : c.owe}>
                {formatMoney(Math.abs(v), cur)}
              </Txt>
            </>
          ) : (
            <Txt size={size} color={v > 0 ? c.owed : c.owe}>
              {v > 0 ? owedLabel : oweLabel} <Txt size={size} weight="700" color={v > 0 ? c.owed : c.owe}>{formatMoney(Math.abs(v), cur)}</Txt>
            </Txt>
          )}
        </View>
      ))}
    </View>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 10 }}>
      <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={40} color={c.brand} />
      </View>
      <Txt size={18} weight="700" center>
        {title}
      </Txt>
      <Txt muted center>
        {text}
      </Txt>
      {action}
    </View>
  );
}

export function Fab({ onPress, label = 'Add expense' }: { onPress: () => void; label?: string }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        position: 'absolute',
        right: 18,
        bottom: 18,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: c.brand,
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderRadius: 28,
        opacity: pressed ? 0.9 : 1,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      })}>
      <Ionicons name="receipt" size={20} color={c.onBrand} />
      <Text style={{ color: c.onBrand, fontWeight: '700', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

export function Loading() {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
      <ActivityIndicator size="large" color={c.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  webWidth: Platform.select({
    web: { flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center' },
    default: { flex: 1 },
  }) as ViewStyle,
});
