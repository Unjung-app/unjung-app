import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/state/auth';
import { color, radius, space } from '@/theme/tokens';

/** 내 권한으로 처리할 일 개수(서버 my_todo). 권한이 없는 항목은 아예 없다 */
export type Todo = {
  total: number;
  feedback?: number;
  notices?: number;
  lost_photos?: number;
  meal_reports?: number;
  survey_requests?: number;
  suggestion_reports?: number;
  suggestions_new?: number;
  enrollment?: number;
};

// 여러 화면(홈 카드·전체 탭 배지)이 같은 값을 쓰도록 작은 공유 저장소
let current: Todo | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
let inflight: Promise<void> | null = null;
let lastAt = 0;

/** 처리할 일 다시 세기. 처리하고 나면 바로 부르면 배지가 줄어든다 */
export function refreshTodo(force = false): Promise<void> {
  if (inflight) return inflight;
  if (!force && Date.now() - lastAt < 15_000) return Promise.resolve();
  inflight = (async () => {
    const { data } = await supabase.rpc('my_todo');
    lastAt = Date.now();
    current = (data as Todo) ?? { total: 0 };
    emit();
    // 홈 화면에 추가한 앱이면 아이콘에 숫자 배지(지원하는 기기만)
    try {
      const nav = globalThis.navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
      if (current.total > 0) await nav?.setAppBadge?.(current.total);
      else await nav?.clearAppBadge?.();
    } catch {
      /* 배지를 못 다는 기기 */
    }
    inflight = null;
  })();
  return inflight;
}

export async function markSeen(key: 'suggestions') {
  await supabase.rpc('mark_seen', { p_key: key });
  await refreshTodo(true);
}

/** 처리할 일. 앱을 다시 열 때·1분마다 새로 센다(로그인한 학생회·관리자·선생님만 서버가 숫자를 준다) */
export function useTodo(): Todo | null {
  const { status } = useAuth();
  const v = useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    () => current,
    () => current,
  );
  useEffect(() => {
    if (status !== 'ready') return;
    refreshTodo();
    const t = setInterval(() => refreshTodo(), 60_000);
    const s = AppState.addEventListener('change', (st) => st === 'active' && refreshTodo(true));
    return () => (clearInterval(t), s.remove());
  }, [status]);
  // 처리하고 돌아오면(홈·전체 탭으로) 바로 다시 센다
  useFocusEffect(
    useCallback(() => {
      if (status === 'ready') refreshTodo(true);
    }, [status]),
  );
  return status === 'ready' ? v : null;
}

/** 숫자 배지(전체 탭 목록 오른쪽) */
export function CountBadge({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <View accessibilityLabel={`처리할 일 ${n}개`} style={{ minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 7, backgroundColor: color.danger, alignItems: 'center', justifyContent: 'center' }}>
      <AppText variant="caption" weight="bold" color="#FFFFFF" style={{ lineHeight: 16 }}>
        {n > 99 ? '99+' : n}
      </AppText>
    </View>
  );
}

const ITEMS: { key: keyof Todo; label: string; href: Href }[] = [
  { key: 'feedback', label: '새 앱 의견', href: '/admin/feedback' },
  { key: 'notices', label: '검토할 공지', href: '/review' },
  { key: 'lost_photos', label: '분실물 사진', href: '/review' },
  { key: 'meal_reports', label: '신고된 한줄평', href: '/review' },
  { key: 'survey_requests', label: '설문 신청', href: '/voice' },
  { key: 'suggestions_new', label: '새 익명 건의', href: '/voice?tab=suggest' },
  { key: 'suggestion_reports', label: '신고된 건의', href: '/voice?tab=suggest' },
  { key: 'enrollment', label: '학번 정정 요청', href: '/admin/staff' },
];

/** 홈 맨 위: 내가 처리할 일이 있으면 바로 보이는 카드 */
export function StaffTodoCard() {
  const router = useRouter();
  const todo = useTodo();
  if (!todo?.total) return null;
  const items = ITEMS.filter((i) => (todo[i.key] as number | undefined) ?? 0);
  return (
    <View style={{ backgroundColor: color.navy, borderRadius: radius.card, padding: space.lg, gap: space.sm }}>
      <AppText variant="label" color={color.accent}>
        🔔 처리할 일 {todo.total}개
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {items.map((i) => (
          <Pressable
            key={i.key}
            accessibilityRole="button"
            accessibilityLabel={`${i.label} ${todo[i.key]}개 처리하러 가기`}
            onPress={() => router.push(i.href)}
            style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, borderRadius: radius.round, backgroundColor: pressed ? color.surfaceMuted : color.surface })}>
            <AppText variant="label">{i.label}</AppText>
            <CountBadge n={todo[i.key] as number} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
