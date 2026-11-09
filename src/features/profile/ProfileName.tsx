import type { ComponentProps } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { NameTag } from '@/components/NameTag';

/** 랭킹의 이름표: 닉네임이 보이면 눌러서 프로필을 연다(숨김·닉네임 없음은 그냥 이름표) */
export function ProfileName({ style, ...props }: ComponentProps<typeof NameTag> & { style?: StyleProp<ViewStyle> }) {
  const router = useRouter();
  const nick = props.nickname;
  if (!nick) {
    return (
      <View style={style}>
        <NameTag {...props} />
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${nick} 프로필 보기`}
      onPress={() => router.push({ pathname: '/profile/[nickname]', params: { nickname: nick } })}
      hitSlop={6}
      style={({ pressed }) => [{ minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.6 : 1 }, style]}>
      <NameTag {...props} />
    </Pressable>
  );
}
