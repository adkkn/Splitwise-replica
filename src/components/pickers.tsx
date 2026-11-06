import { Ionicons } from '@expo/vector-icons';
import { Fragment, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Avatar, Card, Divider, Field, IconBadge, Row, Sheet, Txt, showError } from '@/components/ui';
import { errorMessage } from '@/lib/supabase';
import { useData } from '@/lib/data';
import { CURRENCIES } from '@/lib/money';
import { CATEGORIES, groupKindInfo, useColors } from '@/lib/theme';

export function CurrencyPicker({ visible, value, onChange, onClose }: { visible: boolean; value: string; onChange: (c: string) => void; onClose: () => void }) {
  const c = useColors();
  return (
    <Sheet visible={visible} onClose={onClose} title="Currency">
      <Card padded={false}>
        {CURRENCIES.map((cur, i) => (
          <Fragment key={cur.code}>
            {i > 0 ? <Divider inset={60} /> : null}
            <Row
              left={<Txt size={26}>{cur.flag}</Txt>}
              title={`${cur.code}`}
              subtitle={cur.name}
              right={value === cur.code ? <Ionicons name="checkmark-circle" size={22} color={c.brand} /> : null}
              onPress={() => {
                onChange(cur.code);
                onClose();
              }}
            />
          </Fragment>
        ))}
      </Card>
    </Sheet>
  );
}

export function CategoryPicker({ visible, value, onChange, onClose }: { visible: boolean; value: string; onChange: (c: string) => void; onClose: () => void }) {
  const c = useColors();
  return (
    <Sheet visible={visible} onClose={onClose} title="Category">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {CATEGORIES.map((cat) => {
          const sel = cat.key === value;
          return (
            <Pressable
              key={cat.key}
              onPress={() => {
                onChange(cat.key);
                onClose();
              }}
              style={{
                width: '30%',
                flexGrow: 1,
                alignItems: 'center',
                gap: 6,
                paddingVertical: 12,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: sel ? c.brand : c.border,
                backgroundColor: c.card,
              }}>
              <IconBadge icon={cat.icon} color={cat.color} size={40} />
              <Txt size={12} weight="600">{cat.label}</Txt>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

/** Pick one or more people from my friends (and optionally add a new friend by email). */
export function PeoplePicker({
  visible,
  title,
  candidates,
  selected,
  onChange,
  onClose,
  allowAddByEmail = true,
}: {
  visible: boolean;
  title: string;
  candidates: string[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
  allowAddByEmail?: boolean;
}) {
  const c = useColors();
  const { profiles, actions } = useData();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const query = q.trim().toLowerCase();
  const list = candidates
    .map((id) => ({ id, p: profiles.get(id) }))
    .filter(({ p }) => p && (!query || p.name.toLowerCase().includes(query) || p.email.includes(query)))
    .sort((a, b) => (a.p?.name ?? '').localeCompare(b.p?.name ?? ''));
  const looksLikeEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(query);
  const emailKnown = [...profiles.values()].some((p) => p.email === query);

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <Field placeholder={allowAddByEmail ? 'Search, or type an email to add someone' : 'Search'} value={q} onChangeText={setQ} autoCapitalize="none" keyboardType="email-address" />
      {allowAddByEmail && looksLikeEmail && !emailKnown ? (
        <Card padded={false}>
          <Row
            left={<IconBadge icon="person-add" color={c.brand} />}
            title={adding ? 'Adding...' : `Add ${query}`}
            subtitle="They will be added as your friend"
            onPress={async () => {
              if (adding) return;
              setAdding(true);
              try {
                const id = await actions.addFriend(query);
                onChange([...selected.filter((x) => x !== id), id]);
                setQ('');
              } catch (e) {
                showError(errorMessage(e));
              } finally {
                setAdding(false);
              }
            }}
          />
        </Card>
      ) : null}
      <Card padded={false}>
        {list.map(({ id, p }, i) => {
          const sel = selected.includes(id);
          return (
            <Fragment key={id}>
              {i > 0 ? <Divider inset={68} /> : null}
              <Row
                left={<Avatar name={p!.name} seed={id} />}
                title={p!.name}
                subtitle={p!.email}
                onPress={() => toggle(id)}
                right={<Ionicons name={sel ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={sel ? c.brand : c.textMuted} />}
              />
            </Fragment>
          );
        })}
        {list.length === 0 ? <Txt muted center style={{ padding: 18 }}>{allowAddByEmail ? 'No matches. Type a full email to add someone new.' : 'No matches.'}</Txt> : null}
      </Card>
    </Sheet>
  );
}

export function GroupPicker({ visible, value, onChange, onClose }: { visible: boolean; value: string | null; onChange: (g: string | null) => void; onClose: () => void }) {
  const c = useColors();
  const { groups } = useData();
  return (
    <Sheet visible={visible} onClose={onClose} title="Choose group">
      <Card padded={false}>
        <Row
          left={<IconBadge icon="person-outline" color={c.textMuted} />}
          title="No group"
          subtitle="Just between friends"
          right={value === null ? <Ionicons name="checkmark-circle" size={22} color={c.brand} /> : null}
          onPress={() => {
            onChange(null);
            onClose();
          }}
        />
        {groups.map((g) => (
          <Fragment key={g.id}>
            <Divider inset={68} />
            <Row
              left={<IconBadge icon={groupKindInfo(g.kind).icon} color={c.brand} />}
              title={g.name}
              subtitle={`${g.memberIds.length} people · ${g.currency}`}
              right={value === g.id ? <Ionicons name="checkmark-circle" size={22} color={c.brand} /> : null}
              onPress={() => {
                onChange(g.id);
                onClose();
              }}
            />
          </Fragment>
        ))}
      </Card>
    </Sheet>
  );
}
