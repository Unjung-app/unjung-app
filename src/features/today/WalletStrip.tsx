import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { useWallet } from '@/state/wallet';
import { color, radius, space } from '@/theme/tokens';

/** '오늘' 홈 머리글 아래: 연속 출석 · 토큰 (누르면 지갑). 출석 토큰 알림은 화면 아래 TokenToast가 띄운다 */
export function WalletStrip() {
  const router = useRouter();
  const { wallet } = useWallet();

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
    </View>
  );
}
