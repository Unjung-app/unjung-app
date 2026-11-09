import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { ProfileName } from '@/features/profile/ProfileName';
import { useWallet } from '@/state/wallet';
import { color, radius, space } from '@/theme/tokens';
import { hm, type ClassBoard } from './api';

const MEDAL = ['🥇', '🥈', '🥉'];

/** 우리 반 이번 주 공부 순위(학생 의견 #33). 처음엔 5명 + 나, 누르면 전체 */
export function ClassBoardCard({ board }: { board: ClassBoard | null }) {
  const { itemById } = useWallet();
  const [all, setAll] = useState(false);
  if (!board) return null;
  const rows = board.rows;
  const meIdx = rows.findIndex((r) => r.mine);
  const shown = all ? rows : rows.filter((r, i) => i < 5 || r.mine);
  return (
    <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>
      <View style={{ padding: space.lg, paddingBottom: space.sm, gap: 2 }}>
        <AppText variant="heading">
          🏫 {board.grade}학년 {board.class_no}반 이번 주 순위
        </AppText>
        <AppText variant="caption" color={color.inkMuted}>
          {board.members}명 중 {board.studied}명 공부함{meIdx >= 0 ? ` · 나는 ${rows[meIdx].rank}위` : ' · 공부를 시작하면 순위에 올라요'}
        </AppText>
      </View>
      {rows.length === 0 ? (
        <AppText variant="body" color={color.inkMuted} style={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}>
          이번 주에 아직 아무도 공부 시간을 재지 않았어요. 첫 번째가 되어 보세요!
        </AppText>
      ) : (
        shown.map((r, i) => (
          <View
            key={i}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 52, borderTopWidth: 1, borderTopColor: color.lineSoft, backgroundColor: r.mine ? color.accentSoft : color.surface }}>
            <AppText variant="bodyStrong" color={color.inkMuted} style={{ width: 28, textAlign: 'center' }}>
              {r.rank <= 3 ? MEDAL[r.rank - 1] : r.rank}
            </AppText>
            <ProfileName style={{ flex: 1 }} nickname={r.hidden ? null : r.nickname} equip={r.equip ?? {}} itemById={itemById} fallback={r.mine ? '나 (닉네임 숨김)' : '익명'} />
            <AppText variant="label" style={{ fontVariant: ['tabular-nums'] }}>
              {hm(r.week_seconds)}
            </AppText>
          </View>
        ))
      )}
      {rows.length > shown.length || all ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={all ? '순위 접기' : '우리 반 순위 전체 보기'}
          onPress={() => setAll((v) => !v)}
          style={({ pressed }) => ({ minHeight: 48, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: color.lineSoft, backgroundColor: pressed ? color.surfaceMuted : color.surface })}>
          <AppText variant="label" color={color.navy}>
            {all ? '접기' : `전체 ${rows.length}명 보기`}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
