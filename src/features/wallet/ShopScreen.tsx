import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { ProfileCard } from '@/components/NameTag';
import { LoginPrompt } from '@/features/wallet/LoginPrompt';
import { seoulNow } from '@/lib/date';
import { useAuth } from '@/state/auth';
import { useWallet, type Equip, type ShopItem, type ShopKind } from '@/state/wallet';
import { color, nameColor, profileTheme, radius, space } from '@/theme/tokens';

const SECTIONS: { kind: ShopKind; title: string; hint: string }[] = [
  { kind: 'shield', title: '스트릭 보호권', hint: '학교 가는 날을 빠져도 연속 출석이 이어져요. 최대 2개' },
  { kind: 'emoji', title: '닉네임 이모지', hint: '닉네임 앞에 붙어요' },
  { kind: 'name_color', title: '닉네임 색', hint: '랭킹과 프로필에서 닉네임 색이 바뀌어요' },
  { kind: 'theme', title: '프로필 테마', hint: '프로필 카드 배경. 운중의 밤에서는 닉네임이 흰색으로 보여요' },
  { kind: 'badge', title: '시즌 배지', hint: '기간 한정. 기간이 지나면 다시 살 수 없어요' },
];

const EQUIP_KEY: Record<Exclude<ShopKind, 'shield'>, keyof Equip> = {
  emoji: 'emoji',
  name_color: 'name_color',
  theme: 'theme',
  badge: 'badge',
};

/** 'YYYY-MM-DD' → 'M월 D일' */
const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;

export function ShopScreen() {
  const { status } = useAuth();
  const { wallet, items, itemById, loadItems, buy, equip } = useWallet();
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (status === 'ready' || status === 'needsEnrollment') loadItems();
  }, [status, loadItems]);

  const today = seoulNow().ymd; // YYYYMMDD
  const onSale = (i: ShopItem) =>
    i.active !== false &&
    (!i.sold_from || i.sold_from.replace(/-/g, '') <= today) && (!i.sold_until || i.sold_until.replace(/-/g, '') >= today);

  const sel = selected ? itemById[selected] : null;
  const owned = new Set(wallet?.inventory ?? []);
  const balance = wallet?.balance ?? 0;

  // 미리보기: 고른 상품을 지금 장착한 것처럼 보여 준다
  const preview = useMemo<Partial<Equip>>(() => {
    const base = { ...(wallet?.equip ?? {}) };
    if (sel && sel.kind !== 'shield') base[EQUIP_KEY[sel.kind]] = sel.id;
    return base;
  }, [wallet?.equip, sel]);

  if (status === 'signedOut') return <LoginPrompt what="꾸미기 상점" />;

  const pick = (id: string) => {
    setSelected(id === selected ? null : id);
    setConfirming(false);
    setMessage(null);
  };

  const run = async (fn: () => Promise<{ ok: true } | { ok: false; message: string }>, done: string) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    setConfirming(false);
    setMessage(r.ok ? { ok: true, text: done } : { ok: false, text: r.message });
  };

  const isEquipped = !!sel && sel.kind !== 'shield' && wallet?.equip[EQUIP_KEY[sel.kind]] === sel.id;
  const isOwned = !!sel && sel.kind !== 'shield' && owned.has(sel.id);
  const shieldFull = sel?.kind === 'shield' && (wallet?.shields ?? 0) >= 2;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Screen topInset={false} contentStyle={{ paddingBottom: sel ? 300 : 0 }}>
        <ProfileCard
          nickname={wallet?.nickname ?? null}
          equip={preview}
          itemById={itemById}
          caption={sel && sel.kind !== 'shield' && !isEquipped ? '미리보기' : '지금 내 프로필'}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText variant="bodyStrong">보유 토큰 🪙 {balance}</AppText>
          <AppText variant="caption" color={color.inkMuted}>
            🛡️ 보호권 {wallet?.shields ?? 0}/2
          </AppText>
        </View>

        {SECTIONS.map((s) => {
          const list = items.filter((i) => i.kind === s.kind && (onSale(i) || owned.has(i.id)));
          if (list.length === 0) return null;
          return (
            <View key={s.kind} style={{ gap: space.sm, marginTop: space.sm }}>
              <AppText variant="heading">{s.title}</AppText>
              <AppText variant="caption" color={color.inkMuted}>
                {s.hint}
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {list.map((i) => (
                  <ItemTile
                    key={i.id}
                    item={i}
                    owned={owned.has(i.id)}
                    equipped={i.kind !== 'shield' && wallet?.equip[EQUIP_KEY[i.kind as Exclude<ShopKind, 'shield'>]] === i.id}
                    selected={selected === i.id}
                    onPress={() => pick(i.id)}
                  />
                ))}
              </View>
            </View>
          );
        })}
        {items.length === 0 ? (
          <AppText variant="body" color={color.inkMuted}>
            상품을 불러오는 중…
          </AppText>
        ) : null}
      </Screen>

      {sel ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', padding: space.lg }}>
          <Card style={{ width: '100%', maxWidth: 520, gap: space.sm, borderWidth: 1, borderColor: color.line }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <AppText variant="heading">
                {sel.kind === 'emoji' || sel.kind === 'shield' ? `${sel.value} ` : ''}
                {sel.name}
              </AppText>
              <AppText variant="bodyStrong" color={color.accentInk}>
                🪙 {sel.price}
              </AppText>
            </View>
            {sel.kind !== 'shield' ? (
              <ProfileCard nickname={wallet?.nickname ?? null} equip={preview} itemById={itemById} />
            ) : null}
            {sel.sold_until ? (
              <AppText variant="caption" color={color.inkMuted}>
                {md(sel.sold_until)}까지 판매
              </AppText>
            ) : null}
            {message ? (
              <AppText variant="label" weight="regular" color={message.ok ? color.success : color.danger}>
                {message.text}
              </AppText>
            ) : null}
            {isOwned ? (
              <Button
                label={isEquipped ? '해제하기' : '장착하기'}
                variant={isEquipped ? 'soft' : 'primary'}
                disabled={busy}
                onPress={() =>
                  run(
                    () => equip(sel.kind as Exclude<ShopKind, 'shield'>, isEquipped ? null : sel.id),
                    isEquipped ? '해제했어요' : '장착했어요',
                  )
                }
              />
            ) : shieldFull ? (
              <Button label="보호권은 2개까지 가질 수 있어요" disabled />
            ) : balance < sel.price ? (
              <Button label={`토큰 ${sel.price - balance}개가 더 필요해요`} disabled />
            ) : confirming ? (
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button label="취소" variant="soft" style={{ flex: 1 }} disabled={busy} onPress={() => setConfirming(false)} />
                <Button
                  label={busy ? '사는 중…' : `${sel.price}토큰 쓰기`}
                  style={{ flex: 2 }}
                  disabled={busy}
                  onPress={() =>
                    run(async () => {
                      const r = await buy(sel.id);
                      if (r.ok && sel.kind !== 'shield') await equip(sel.kind, sel.id);
                      return r;
                    }, sel.kind === 'shield' ? '보호권을 샀어요' : '샀어요! 바로 장착했어요')
                  }
                />
              </View>
            ) : (
              <Button label="사기" disabled={busy} onPress={() => setConfirming(true)} />
            )}
          </Card>
        </View>
      ) : null}
    </View>
  );
}

function ItemTile({
  item,
  owned,
  equipped,
  selected,
  onPress,
}: {
  item: ShopItem;
  owned: boolean;
  equipped: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const wide = item.kind === 'theme' || item.kind === 'badge' || item.kind === 'shield';
  const swatch =
    item.kind === 'name_color' ? nameColor[item.value] : item.kind === 'theme' ? profileTheme[item.value]?.bg : undefined;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${owned ? (equipped ? '장착 중' : '보유') : `${item.price}토큰`}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        width: wide ? '48%' : '23%',
        minHeight: 72,
        borderRadius: radius.control,
        borderWidth: 2,
        borderColor: selected ? color.navy : equipped ? color.accent : color.line,
        backgroundColor: pressed ? color.surfaceMuted : color.surface,
        alignItems: 'center',
        justifyContent: 'center',
        padding: space.sm,
        gap: 4,
      })}>
      {item.kind === 'emoji' || item.kind === 'shield' ? (
        <AppText style={{ fontSize: 26, lineHeight: 32 }}>{item.value}</AppText>
      ) : swatch ? (
        <View
          style={{
            width: wide ? '100%' : 28,
            height: 28,
            borderRadius: wide ? 8 : 14,
            backgroundColor: swatch,
            borderWidth: 1,
            borderColor: item.kind === 'theme' ? profileTheme[item.value]?.edge : swatch,
          }}
        />
      ) : (
        <View style={{ backgroundColor: color.navy, borderRadius: radius.round, paddingHorizontal: 8, paddingVertical: 2 }}>
          <AppText variant="caption" weight="semibold" color={color.accent}>
            {item.value}
          </AppText>
        </View>
      )}
      {(wide && item.kind !== 'badge') || item.kind === 'name_color' ? (
        <AppText variant="caption" color={item.kind === 'name_color' ? swatch : color.ink} weight="semibold">
          {item.name}
        </AppText>
      ) : null}
      {owned ? (
        <Badge label={equipped ? '장착' : '보유'} tone={equipped ? 'accent' : 'success'} />
      ) : (
        <AppText variant="caption" color={color.inkMuted}>
          🪙 {item.price}
        </AppText>
      )}
    </Pressable>
  );
}
