import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { REWARD } from '@/lib/rewards';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Badge, Divider, ListRow } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { AccountCard } from '@/features/auth/AccountCard';
import { classLabel, useOpenFeature } from '@/features/hooks';
import { DEV_TEAM, DEV_TEAM_NAME, FEATURE_BY_ID, FEATURES } from '@/features/registry';
import { TeamCard, useLaunchEvent } from '@/features/launch/Launch';
import { supabase } from '@/lib/supabase';
import { APP_VERSION } from '@/lib/build';
import { LAB_FEATURES, labVisible } from '@/lab/registry';
import { CountBadge, useTodo } from '@/features/admin/todo';
import { useAuth } from '@/state/auth';
import { usePrefs } from '@/state/prefs';
import { useWallet } from '@/state/wallet';
import { color, radius, space } from '@/theme/tokens';

/** '전체'의 묶음 (registry id) */
const COUNCIL = ['notice', 'voice', 'gallery'];
const SCHOOL = ['timetable', 'meal', 'tasks', 'calendar', 'library', 'lost'];
const FUN = ['study', 'games', 'ranking'];

/** 부서 권한(소통홍보부·교육활동부). 서버 함수가 없거나 실패하면 false */
function useDeptFlags(enabled: boolean) {
  const [flags, setFlags] = useState({ comm: false, study: false, dev: false });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    Promise.all([supabase.rpc('is_comm'), supabase.rpc('is_study_manager'), supabase.rpc('is_developer')]).then(([c, m, d]) => {
      if (alive) setFlags({ comm: c.data === true, study: m.data === true, dev: d.data === true });
    });
    return () => {
      alive = false;
    };
  }, [enabled]);
  return flags;
}

export function MoreScreen() {
  const router = useRouter();
  const openFeature = useOpenFeature();
  const { myClass } = usePrefs();
  const { status, role, planner, teacher } = useAuth();
  const todo = useTodo();
  const { wallet } = useWallet();
  const { mult } = useLaunchEvent();
  const signedIn = status === 'ready' || status === 'needsEnrollment';
  const dept = useDeptFlags(status === 'ready');
  const soon = FEATURES.filter((f) => f.status === 'soon');
  const isAdmin = role === 'admin';
  const reviewer = signedIn && role !== 'student';
  const hasTools = status === 'ready' && (isAdmin || reviewer || planner || !!teacher || dept.comm || dept.study || dept.dev);

  const group = (children: React.ReactNode) => (
    <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>{children}</View>
  );
  const heading = (t: string) => (
    <AppText variant="heading" style={{ marginTop: space.sm }}>
      {t}
    </AppText>
  );
  /** 행 목록을 구분선과 함께 그린다(null은 건너뜀) */
  const rows = (items: (React.ReactElement | null | false)[]) =>
    group(
      items
        .filter((x): x is React.ReactElement => !!x)
        .map((el, i) => (
          <View key={i}>
            {i > 0 ? <Divider /> : null}
            {el}
          </View>
        )),
    );
  const feature = (id: string) => {
    const f = FEATURE_BY_ID[id];
    return f && f.status === 'live' ? <ListRow icon={f.icon} title={f.title} subtitle={f.desc} onPress={() => openFeature(f.id)} /> : null;
  };

  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header">
        전체
      </AppText>

      <AccountCard isDeveloper={status === 'ready' && dept.dev} />

      {hasTools ? (
        <>
          {heading('🛠️ 내 부서 도구')}
          {rows([
            !!teacher && <ListRow icon="study" title="스터디 윗미 현황" subtitle="선생님 · 반별 참여·학생별 공부 기록" onPress={() => openFeature('study')} />,
            dept.comm && <ListRow icon="camera" title="행사 사진 올리기" subtitle={teacher ? '선생님 · 홈에 바로 보여요' : '소통홍보부 · 홈에 바로 보여요'} onPress={() => router.push('/gallery/new')} />,
            (dept.comm || planner) && <ListRow icon="notice" title="공지 올리기" subtitle={teacher ? '선생님 · 전체·학년·반 골라 바로 게시' : '검토 없이 바로 게시돼요'} onPress={() => router.push('/notice/new')} />,
            !!teacher && !planner && <ListRow icon="voice" title="설문 만들기" subtitle="선생님 · '선생님 설문'으로 올라가요" onPress={() => router.push('/voice/survey/new')} />,
            !!teacher && !isAdmin && <ListRow icon="ranking" title="앱 사용 현황" subtitle="선생님 · 가입·매일 접속·기능별 사용" onPress={() => router.push('/admin/usage')} />,
            planner && <ListRow icon="voice" title="설문·찬반 투표 만들기" subtitle="기획행정부 · 학생 설문 신청 승인도 여기서" right={<CountBadge n={todo?.survey_requests} />} onPress={() => router.push('/voice')} />,
            planner && <ListRow icon="check" title="익명 건의 확인" subtitle="기획행정부 · 확인 표시·숨기기" right={<CountBadge n={(todo?.suggestions_new ?? 0) + (todo?.suggestion_reports ?? 0)} />} onPress={() => router.push('/voice?tab=suggest')} />,
            dept.study && <ListRow icon="study" title="스터디 윗미 관리" subtitle="교육활동부 · 그룹 → 관리자 보기" onPress={() => openFeature('study')} />,
 !isAdmin && dept.dev && <ListRow icon="ranking" title="앱 사용 현황 · 게임별" subtitle="개발자 · 내 게임을 몇 명이 하는지" onPress={() => router.push('/admin/usage')} />,
            !isAdmin && dept.dev && <ListRow icon="settings" title="의견 관리" subtitle="개발자 · 내 게임에 온 학생 의견 확인·답변" right={<CountBadge n={todo?.feedback} />} onPress={() => router.push('/admin/feedback')} />,
            reviewer && <ListRow icon="check" title="검토하기" subtitle="공지 승인·신고 처리·분실물 사진 (검토위원)" right={<CountBadge n={(todo?.notices ?? 0) + (todo?.lost_photos ?? 0) + (todo?.meal_reports ?? 0)} />} onPress={() => router.push('/review')} />,
            isAdmin && <ListRow icon="ranking" title="앱 사용 현황" subtitle="가입·매일 접속·기능별·게임별 사용 (관리자)" onPress={() => router.push('/admin/usage')} />,
            isAdmin && <ListRow icon="user" title="학생 관리" subtitle="학적 정정 요청·직책·닉네임·토큰 (관리자)" right={<CountBadge n={todo?.enrollment} />} onPress={() => router.push('/admin/staff')} />,
            isAdmin && <ListRow icon="settings" title="의견 관리" subtitle="학생이 보낸 앱 의견 (관리자)" right={<CountBadge n={todo?.feedback} />} onPress={() => router.push('/admin/feedback')} />,
          ])}
        </>
      ) : null}

      {heading('🏫 학생회')}
      {rows([
        ...COUNCIL.map(feature),
        <ListRow icon="voice" title="앱 의견 보내기" subtitle={`버그 제보·개선 요청 · 반영되면 +${REWARD.feedbackDone * mult} 토큰`} onPress={() => router.push('/feedback?from=전체')} />,
      ])}

      {heading('📚 학교생활')}
      {rows(SCHOOL.map(feature))}

      {heading('🎮 공부·놀이')}
      {rows([
        ...FUN.map(feature),
        signedIn && (
          <ListRow
            icon="coin"
            title="토큰·출석"
            subtitle={wallet ? `🪙 ${wallet.balance} · 🔥 ${wallet.streak}일 연속` : '불러오는 중'}
            onPress={() => router.push('/wallet')}
          />
        ),
        signedIn && <ListRow icon="bag" title="꾸미기 상점" subtitle="이모지·닉네임 색·프로필 테마" onPress={() => router.push('/shop')} />,
      ])}

      {heading('⚙️ 내 설정')}
      {rows([
        signedIn && (
          <ListRow
            icon="user"
            title="닉네임"
            subtitle={wallet?.nickname ?? '아직 없어요 · 랭킹·스터디 그룹에 쓰일 이름'}
            onPress={() => router.push('/settings/nickname')}
          />
        ),
        <ListRow icon="pin" title={classLabel(myClass)} subtitle="내 반 설정" onPress={() => router.push('/settings/class')} />,
        <ListRow icon="notice" title="알림 설정" subtitle="마감 전날·아침 급식·내 글 소식" onPress={() => router.push('/settings/notifications')} />,
        <ListRow icon="settings" title="하단 탭 설정" subtitle="자주 쓰는 기능을 아래 탭에 고정해요" onPress={() => router.push('/settings/tabs')} />,
        <ListRow icon="plus" title="홈 화면에 추가" subtitle="앱처럼 바로 열고 알림 받기" onPress={() => router.push('/settings/install')} />,
        <ListRow icon="notice" title="업데이트 소식" subtitle={`v${APP_VERSION} · 업데이트마다 바뀐 점`} onPress={() => router.push('/settings/updates')} />,
      ])}

      <AppText variant="heading" style={{ marginTop: space.sm }}>
        준비 중
      </AppText>
      {group(
        soon.map((f, i) => (
          <View key={f.id}>
            {i > 0 ? <Divider /> : null}
            <ListRow
              icon={f.icon}
              title={f.title}
              subtitle={f.desc}
              onPress={() => openFeature(f.id)}
              right={<Badge label="준비 중" tone="muted" />}
            />
          </View>
        )),
      )}

      {labVisible(role) && LAB_FEATURES.length > 0 ? (
        <>
          <AppText variant="heading" style={{ marginTop: space.sm }}>
            실험실 (베타)
          </AppText>
          <AppText variant="caption" color={color.inkMuted}>
            학생 개발팀이 만들고 있는 기능이에요. 개발 환경과 관리자에게만 보여요.
          </AppText>
          {group(
            LAB_FEATURES.map((f, i) => (
              <View key={f.slug}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  title={`${f.emoji ?? '🧪'} ${f.title}`}
                  subtitle={[f.desc, f.makers.length ? `만든 사람 · ${f.makers.join(', ')}` : ''].filter(Boolean).join(' · ')}
                  onPress={() => router.push(`/lab/${f.slug}`)}
                  right={<Badge label={f.status === 'ready' ? '완성' : '만드는 중'} tone={f.status === 'ready' ? 'success' : 'muted'} />}
                />
              </View>
            )),
          )}
        </>
      ) : null}

      <View style={{ marginTop: space.xl }}>
        <TeamCard />
      </View>
      <View style={{ marginTop: space.sm, gap: 4, alignItems: 'center' }}>
        <AppText variant="caption" color={color.inkMuted} align="center">
          {DEV_TEAM_NAME}
        </AppText>
        <AppText variant="caption" color={color.inkFaint} align="center">
          만든 사람들: {DEV_TEAM.join(', ')}
        </AppText>
      </View>
    </Screen>
  );
}
