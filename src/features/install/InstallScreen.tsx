import { View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { color, radius, space } from '@/theme/tokens';
import { useInstall } from './useInstall';

function Step({ n, title, desc, icon }: { n: number; title: string; desc?: string; icon?: IconName }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: color.navy,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <AppText variant="label" color={color.onNavy}>
          {n}
        </AppText>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <AppText variant="bodyStrong">{title}</AppText>
          {icon ? <Icon name={icon} size={18} color={color.navy} /> : null}
        </View>
        {desc ? (
          <AppText variant="caption" color={color.inkMuted}>
            {desc}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/** 홈 화면에 추가 안내. 기기·브라우저에 맞는 방법만 보여 준다. */
export function InstallScreen() {
  const { env, promptInstall, openExternal } = useInstall();

  return (
    <Screen topInset={false}>
      <Card tone="navy">
        <AppText variant="heading" color={color.onNavy} style={{ fontSize: 20, lineHeight: 28 }}>
          홈 화면에 추가하면{'\n'}앱처럼 바로 열려요
        </AppText>
        <AppText variant="body" color={color.onNavySub}>
          스토어 설치 없이, 저장 공간도 거의 쓰지 않아요. 알림도 받을 수 있어요.
        </AppText>
      </Card>

      {env.kind === 'installed' || env.kind === 'native' ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Icon name="check" size={22} color={color.success} />
            <AppText variant="heading">이미 설치되어 있어요</AppText>
          </View>
        </Card>
      ) : null}

      {env.kind === 'inapp' ? (
        <Card>
          <AppText variant="heading">지금은 {env.isKakao ? '카카오톡' : '다른 앱'} 안에서 열려 있어요</AppText>
          <AppText variant="body" color={color.inkMuted}>
            앱 안 브라우저에서는 설치할 수 없어요. 휴대폰 기본 브라우저(크롬·사파리·삼성 인터넷)로 다시 열어 주세요.
          </AppText>
          {env.isKakao ? (
            <Button label="기본 브라우저로 열기" icon="external" onPress={openExternal} />
          ) : (
            <Step n={1} title="오른쪽 위(또는 아래) ⋯ 메뉴" desc="'다른 브라우저로 열기' 또는 '브라우저에서 열기'를 눌러요" />
          )}
        </Card>
      ) : null}

      {env.kind === 'android' || env.kind === 'desktop' ? (
        <Card>
          <AppText variant="heading">안드로이드 · 크롬</AppText>
          {env.canPrompt ? (
            <Button label="앱 설치하기" icon="plus" onPress={() => promptInstall()} />
          ) : (
            <View style={{ gap: space.md }}>
              <Step n={1} title="오른쪽 위 ⋮ 메뉴" />
              <Step n={2} title="'앱 설치' 또는 '홈 화면에 추가'" desc="삼성 인터넷은 메뉴 → '페이지 추가' → '홈 화면'" />
              <Step n={3} title="홈 화면의 '운중고' 아이콘으로 열기" />
            </View>
          )}
        </Card>
      ) : null}

      {env.kind === 'ios' ? (
        <Card>
          <AppText variant="heading">아이폰 · 아이패드</AppText>
          <View style={{ gap: space.md }}>
            <Step n={1} title="브라우저의 공유 버튼" icon="share" desc="사파리는 화면 아래(또는 주소창 옆) 네모에서 화살표가 나오는 버튼" />
            <Step n={2} title="'홈 화면에 추가'" desc="목록에 안 보이면 아래로 내리거나 '더 보기'를 눌러요" />
            <Step n={3} title="오른쪽 위 '추가'" desc="홈 화면의 '운중고' 아이콘으로 열면 알림도 받을 수 있어요" />
          </View>
        </Card>
      ) : null}

      <View style={{ backgroundColor: color.surface, borderRadius: radius.card, padding: space.lg, gap: 6 }}>
        <AppText variant="label">설치가 안 되나요?</AppText>
        <AppText variant="caption" color={color.inkMuted}>
          시크릿(비공개) 창에서는 설치할 수 없어요. 일반 창에서 unjung-app.vercel.app 을 열어 주세요.
        </AppText>
      </View>
    </Screen>
  );
}
