import { View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import type { Equip, ShopItem } from '@/state/wallet';
import { color, nameColor, profileTheme, radius, space } from '@/theme/tokens';

type Props = {
  nickname: string | null;
  equip: Partial<Equip>;
  itemById: Record<string, ShopItem>;
  /** 닉네임이 없을 때 대신 보일 이름 (예: '익명의 2학년') */
  fallback?: string;
  size?: 'md' | 'lg';
  /** 어두운 배경 위에 그릴 때 */
  onDark?: boolean;
};

/** 다른 학생에게 보이는 이름표: 이모지 + 닉네임(색) + 배지. 랭킹·공지 작성자·프로필에서 같이 쓴다. */
export function NameTag({ nickname, equip, itemById, fallback = '닉네임 없음', size = 'md', onDark }: Props) {
  const emoji = equip.emoji ? itemById[equip.emoji]?.value : null;
  const colorKey = equip.name_color ? itemById[equip.name_color]?.value : null;
  const badge = equip.badge ? itemById[equip.badge]?.value : null;
  const ink = onDark ? color.onNavy : colorKey ? nameColor[colorKey] ?? color.ink : color.ink;
  const big = size === 'lg';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {emoji ? <AppText style={{ fontSize: big ? 24 : 17, lineHeight: big ? 30 : 22 }}>{emoji}</AppText> : null}
      <AppText variant={big ? 'title' : 'bodyStrong'} color={nickname ? ink : onDark ? color.onNavyMuted : color.inkMuted}>
        {nickname ?? fallback}
      </AppText>
      {badge ? (
        <View style={{ backgroundColor: color.navy, borderRadius: radius.round, paddingHorizontal: 8, paddingVertical: 2 }}>
          <AppText variant="caption" weight="semibold" color={color.accent}>
            {badge}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

/** 테마 배경이 깔린 프로필 카드 (지갑·상점 미리보기) */
export function ProfileCard({
  nickname,
  equip,
  itemById,
  caption,
}: {
  nickname: string | null;
  equip: Partial<Equip>;
  itemById: Record<string, ShopItem>;
  caption?: string;
}) {
  const themeKey = equip.theme ? itemById[equip.theme]?.value : null;
  const t = profileTheme[themeKey ?? 'plain'] ?? profileTheme.plain;
  const dark = themeKey === 'night';
  return (
    <View
      style={{
        backgroundColor: t.bg,
        borderRadius: radius.card,
        borderWidth: 2,
        borderColor: t.edge,
        padding: space.xl,
        gap: 4,
      }}>
      <NameTag nickname={nickname} equip={equip} itemById={itemById} size="lg" onDark={dark} />
      {caption ? (
        <AppText variant="caption" color={t.sub}>
          {caption}
        </AppText>
      ) : null}
    </View>
  );
}
