import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { useWallet } from '@/state/wallet';
import { color, radius, space } from '@/theme/tokens';

/** '오늘' 홈 머리글 아래: 연속 출석 · 토큰 (누르면 지갑) + 오늘 첫 출석 안내 */
export function WalletStrip() {
  const router = useRouter();
  const { wallet, checkin, dismissCheckin } = useWallet();

  // 출석 안내는 6초 뒤 저절로 닫힌다
  useEffect(() => {
    if (!checkin) return;
    const id = setTimeout(dismissCheckin, 6000);
    return () => clearTimeout(id);
  }, [checkin, dismissCheckin]);

  if (!wallet) return null;

  const pill = (label: string, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${a11y}, 토큰·출석 화면 열기`}
      onPress={() => router.push('/wallet')}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: space.md,
        borderRadius: radius.round,
        backgroundColor: pressed ? color.surfaceMuted : color.surface,
        borderWidth: 1,
        borderColor: color.line,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      })}>
      <AppText variant="bodyStrong">{label}</AppText>
    </Pressable>
  );

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {pill(`🔥 ${wallet.streak}일 연속`, `연속 출석 ${wallet.streak}일`)}
        {pill(`🪙 ${wallet.balance}`, `토큰 ${wallet.balance}개`)}
      </View>
      {checkin ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="출석 안내 닫기"
          onPress={dismissCheckin}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            backgroundColor: color.accentSoft,
            borderRadius: radius.control,
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
            minHeight: 44,
          }}>
          <AppText variant="label" color={color.accentInk} style={{ flex: 1 }}>
            {checkin.shield_used > 0
              ? `보호권 ${checkin.shield_used}개로 연속 출석을 지켰어요! `
              : ''}
            출석 +{checkin.tokens} 토큰
            {checkin.school_day ? ` · ${checkin.streak}일 연속` : ' · 주말엔 연속 출석이 쉬어요'}
            {checkin.tokens >= 10 ? ' · 7일 보너스 🎉' : ''}
          </AppText>
          <Icon name="close" size={16} color={color.accentInk} />
        </Pressable>
      ) : null}
    </View>
  );
}
