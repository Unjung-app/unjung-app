import { useCallback, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button, Card, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { useWeekTimetable } from '@/features/data';
import { useNow } from '@/features/hooks';
import { inputStyle } from '@/features/voice/ui';
import { dDayLabel, diffDays, longLabel } from '@/lib/date';
import { REWARD } from '@/lib/rewards';
import { useAuth } from '@/state/auth';
import { usePrefs } from '@/state/prefs';
import { color, radius, space, subjectColor } from '@/theme/tokens';
import { call, hm, hms, isoDayToYmd, useDashboard, useGroupList, type GroupInfo, type Subject } from './api';
import { useStudyLive } from './session';
import { StudyCalendar } from './StudyCalendar';

const COLORS = Object.keys(subjectColor);

/**
 * 스터디 윗미 첫 화면(열품타식): 오늘 총 공부 시간 → 내 그룹 → 과목 목록(▶ 누르면 집중 화면).
 * 집중(시간 재기)은 /study/focus 화면에서만 한다. 이 화면은 기록·그룹·과목 관리.
 */
export function StudyScreen({ inStack = false }: { inStack?: boolean }) {
  const router = useRouter();
  const now = useNow();
  const { status } = useAuth();
  const { myClass } = usePrefs();
  const ready = status === 'ready';
  const dash = useDashboard(ready);
  const groups = useGroupList(ready);
  const live = useStudyLive(ready);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);

  // 집중 화면에서 돌아오면 새 기록으로
  useFocusEffect(
    useCallback(() => {
      dash.reload();
      groups.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dash.reload, groups.reload]),
  );

  const tt = useWeekTimetable(now.ymd, myClass);
  const suggestions = useMemo(() => {
    const have = new Set((dash.data?.subjects ?? []).map((s) => s.name));
    const set = new Set<string>();
    for (const l of tt.items) if (l.subject && !/자율|동아리|창체/.test(l.subject) && !have.has(l.subject)) set.add(l.subject);
    return [...set].slice(0, 8);
  }, [tt.items, dash.data?.subjects]);

  if (!ready) {
    return (
      <Screen topInset={!inStack}>
        {!inStack ? <Title /> : null}
        <Card tone="navy">
          <AppText variant="heading" color={color.onNavy} style={{ fontSize: 20, lineHeight: 28 }}>
            {status === 'needsEnrollment' ? '학번을 등록하면\n친구들과 함께 공부 시간을 잴 수 있어요' : '학교 계정으로 로그인하면\n과목별 공부 시간과 그룹 랭킹을 볼 수 있어요'}
          </AppText>
          <Button
            label={status === 'needsEnrollment' ? '학번 등록하기' : '로그인하기'}
            variant="soft"
            style={{ backgroundColor: color.surface }}
            onPress={() => router.push(status === 'needsEnrollment' ? '/onboarding' : '/login')}
          />
        </Card>
      </Screen>
    );
  }

  const d = dash.data;
  const subjects = d?.subjects ?? [];
  const bySubject = d?.by_subject ?? {};
  const joinable = (groups.data ?? []).filter((g) => !g.joined && g.can_join);
  const manager = d?.manager ?? false;
  const focus = (s: { name: string; color: string }) => router.push({ pathname: '/study/focus', params: { subject: s.name, color: s.color } });

  return (
    <Screen topInset={!inStack} onRefresh={() => (dash.reload(), groups.reload())}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {!inStack ? <Title /> : <View />}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: color.surface, borderRadius: radius.round, paddingHorizontal: space.md, paddingVertical: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: live?.all ? color.success : color.inkFaint }} />
          <AppText variant="label" color={color.inkMuted}>
            지금 {live?.all ?? 0}명 공부 중
          </AppText>
        </View>
      </View>

      {/* 오늘 총 시간 */}
      <Card tone="navy" style={{ alignItems: 'center', gap: 2, paddingVertical: space.xxl }}>
        <AppText variant="label" color={color.onNavyMuted}>
          {longLabel(now.ymd)}
        </AppText>
        <AppText
          color={color.onNavy}
          weight="bold"
          style={{ fontSize: 48, lineHeight: 58, fontVariant: ['tabular-nums'] }}
          accessibilityLabel={`오늘 공부 ${hm(d?.today.total_seconds ?? 0)}`}>
          {hms(d?.today.total_seconds ?? 0)}
        </AppText>
        <AppText variant="caption" color={color.onNavySub}>
          이번 주 {hm(d?.week_total_seconds ?? 0)} · 공부 토큰 {d?.today.tokens ?? 0}/{REWARD.studyDailyCap}
        </AppText>
        <Button
          label="▶  공부 시작"
          variant="soft"
          style={{ alignSelf: 'stretch', backgroundColor: color.accent, minHeight: 52, marginTop: space.md }}
          onPress={() => focus(subjects[0] ?? { name: '', color: 'navy' })}
          accessibilityLabel={subjects[0] ? `${subjects[0].name} 공부 시작` : '공부 시작'}
        />
      </Card>
      {dash.error && !d ? (
        <AppText variant="caption" color={color.danger}>
          기록을 불러오지 못했어요. {dash.error}
        </AppText>
      ) : null}

      {/* 그룹 */}
      {(d?.groups ?? []).map((g) => (
        <Pressable
          key={g.id}
          accessibilityRole="button"
          accessibilityLabel={`${g.name}, ${g.members}명 중 ${g.live}명 공부 중, 순위 보기`}
          onPress={() => router.push(`/study/group/${g.id}`)}
          style={({ pressed }) => ({ backgroundColor: pressed ? color.surfaceMuted : color.surface, borderRadius: radius.card, padding: space.lg, gap: 4, borderWidth: 2, borderColor: color.accent })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <AppText variant="heading" style={{ flex: 1 }} numberOfLines={1}>
              👥 {g.name}
            </AppText>
            <AppText variant="label" color={color.accentInk}>
              {endLabel(now.ymd, g.ends_on)}
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: g.live ? color.success : color.inkFaint }} />
            <AppText variant="label" weight="regular" color={color.inkMuted} style={{ flex: 1 }}>
              {g.members}명 중 {g.live}명 공부 중
            </AppText>
            <AppText variant="label" color={color.navy}>
              순위 보기 ›
            </AppText>
          </View>
        </Pressable>
      ))}
      {joinable.map((g) => (
        <JoinCard key={g.id} g={g} onJoined={() => (dash.reload(), groups.reload())} />
      ))}
      {manager ? (
        <Card tone="muted" style={{ gap: space.sm }}>
          <AppText variant="label">교육활동부 관리</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {(groups.data ?? []).map((g) => (
              <Button key={g.id} label={`${g.name} (${g.members}명)`} variant="soft" onPress={() => router.push(`/study/admin/${g.id}`)} />
            ))}
          </View>
        </Card>
      ) : null}

      {/* 과목 */}
      <SectionTitle
        title="과목"
        right={
          subjects.length ? (
            <Pressable accessibilityRole="button" accessibilityLabel={editing ? '편집 끝내기' : '과목 편집'} onPress={() => setEditing((v) => !v)} hitSlop={12} style={{ minHeight: 44, justifyContent: 'center' }}>
              <AppText variant="label" color={color.navy}>
                {editing ? '완료' : '편집'}
              </AppText>
            </Pressable>
          ) : null
        }
      />
      <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>
        {subjects.map((s, i) => (
          <SubjectRow key={s.id} s={s} seconds={bySubject[s.name] ?? 0} first={i === 0} editing={editing} onPlay={() => focus(s)} onChanged={dash.reload} />
        ))}
        <SubjectRow s={{ id: 0, name: '', color: 'gray', sort: 999 }} seconds={bySubject[''] ?? 0} first={!subjects.length} editing={false} onPlay={() => focus({ name: '', color: 'gray' })} onChanged={dash.reload} />
        {adding ? (
          <AddSubject
            suggestions={suggestions}
            nextColor={COLORS[subjects.length % COLORS.length]}
            sort={subjects.length}
            onDone={() => {
              setAdding(false);
              dash.reload();
            }}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="과목 추가"
            onPress={() => setAdding(true)}
            style={({ pressed }) => ({ minHeight: 52, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: color.lineSoft, backgroundColor: pressed ? color.surfaceMuted : color.surface })}>
            <AppText variant="label" color={color.navy}>
              + 과목 추가
            </AppText>
          </Pressable>
        )}
      </View>

      <SectionTitle title="기록 달력" />
      <StudyCalendar today={now.ymd} subjects={subjects} />

      <Card tone="muted" style={{ gap: 6 }}>
        <AppText variant="label">시간 재기 규칙</AppText>
        <AppText variant="caption" color={color.inkMuted}>
          • 집중 화면을 켜 둔 동안만 시간이 올라가요. 그동안 폰 화면은 저절로 꺼지지 않아요(잠금 버튼을 누르면 멈춰요).{'\n'}• 다른 앱으로 가면 바로 멈추고, 60초 안에 돌아오면 이어져요.
          {'\n'}• 수업 시간에 잰 시간도 오늘 기록·그룹 순위에 들어가요. 토큰과 반 랭킹에서만 빠져요.{'\n'}• 토큰: 처음 2시간은 10분마다, 그 뒤 15분마다 +1 (하루 최대 {REWARD.studyDailyCap}).
        </AppText>
      </Card>
    </Screen>
  );
}

function Title() {
  return (
    <AppText variant="title" accessibilityRole="header">
      스터디 윗미
    </AppText>
  );
}

/** 'D-3' / '오늘 마감' / '11/9 시작' */
function endLabel(today: string, endsOn: string) {
  const end = isoDayToYmd(endsOn);
  const n = diffDays(today, end);
  return n === 0 ? '오늘 마감' : n < 0 ? '끝남' : dDayLabel(today, end);
}

function SubjectRow({ s, seconds, first, editing, onPlay, onChanged }: { s: Subject; seconds: number; first: boolean; editing: boolean; onPlay: () => void; onChanged: () => void }) {
  const name = s.name || '자습 (과목 없이)';
  const [busy, setBusy] = useState(false);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingLeft: space.lg, paddingRight: space.sm, gap: space.md, borderTopWidth: first ? 0 : 1, borderTopColor: color.lineSoft }}>
      <View style={{ width: 6, alignSelf: 'stretch', marginVertical: space.md, borderRadius: 3, backgroundColor: subjectColor[s.color] ?? subjectColor.gray }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="bodyStrong" numberOfLines={1} color={s.name ? color.ink : color.inkMuted}>
          {name}
        </AppText>
        <AppText variant="caption" color={color.inkMuted} style={{ fontVariant: ['tabular-nums'] }}>
          오늘 {hms(seconds)}
        </AppText>
      </View>
      {editing && s.id ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${s.name} 과목 지우기`}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            await call('delete_study_subject', { p_id: s.id });
            setBusy(false);
            onChanged();
          }}
          style={{ minWidth: 64, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.control, backgroundColor: color.dangerSoft }}>
          <AppText variant="label" color={color.danger}>
            지우기
          </AppText>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name} 공부 시작`}
          onPress={onPlay}
          style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? color.navyRaised : color.navy })}>
          <AppText color={color.onNavy} style={{ fontSize: 18, lineHeight: 22, marginLeft: 3 }}>
            ▶
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

function AddSubject({ suggestions, nextColor, sort, onDone }: { suggestions: string[]; nextColor: string; sort: number; onDone: () => void }) {
  const [name, setName] = useState('');
  const [c, setC] = useState(nextColor);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async (n: string) => {
    if (!n.trim()) return;
    setBusy(true);
    const e = await call('save_study_subject', { p_id: null, p_name: n.trim(), p_color: c, p_sort: sort });
    setBusy(false);
    if (e) setErr(e);
    else onDone();
  };
  return (
    <View style={{ padding: space.lg, gap: space.sm, borderTopWidth: 1, borderTopColor: color.lineSoft }}>
      <TextInput
        accessibilityLabel="과목 이름"
        value={name}
        onChangeText={(t) => setName(t.slice(0, 20))}
        placeholder="예) 수학, 영어 단어, 국어 문학"
        placeholderTextColor={color.inkFaint}
        autoFocus
        onSubmitEditing={() => save(name)}
        style={{ ...inputStyle, minHeight: 48 }}
      />
      {suggestions.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {suggestions.map((x) => (
            <Pressable key={x} accessibilityRole="button" accessibilityLabel={`${x} 넣기`} onPress={() => setName(x)} style={{ minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.round, justifyContent: 'center', backgroundColor: color.surfaceMuted }}>
              <AppText variant="label">{x}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }} accessibilityRole="radiogroup" accessibilityLabel="과목 색">
        {Object.entries(subjectColor).map(([k, v]) => (
          <Pressable key={k} accessibilityRole="radio" accessibilityLabel={`색 ${k}`} accessibilityState={{ checked: c === k }} onPress={() => setC(k)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: v, borderWidth: c === k ? 3 : 0, borderColor: color.ink }} />
          </Pressable>
        ))}
      </View>
      {err ? (
        <AppText variant="caption" color={color.danger}>
          {err}
        </AppText>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button label="취소" variant="soft" style={{ flex: 1 }} onPress={onDone} />
        <Button label={busy ? '저장 중…' : '추가'} style={{ flex: 1 }} disabled={busy || !name.trim()} onPress={() => save(name)} />
      </View>
    </View>
  );
}

function JoinCard({ g, onJoined }: { g: GroupInfo; onJoined: () => void }) {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const full = g.members >= g.capacity;
  const join = async () => {
    setBusy(true);
    const e = await call('join_study_group', { p_id: g.id, p_password: pw });
    setBusy(false);
    if (e) setErr(e);
    else onJoined();
  };
  return (
    <Card style={{ gap: space.sm, borderWidth: 2, borderColor: color.accent }}>
      <AppText variant="label" color={color.accentInk}>
        교육활동부 행사 · {g.starts_on.slice(5).replace('-', '/')}~{g.ends_on.slice(5).replace('-', '/')}
      </AppText>
      <AppText variant="heading">🔒 {g.name}</AppText>
      <AppText variant="caption" color={color.inkMuted}>
        {g.description || '비밀번호를 아는 학생만 들어올 수 있어요.'}
        {'\n'}지금 {g.members}/{g.capacity}명 · 그룹 안에서는 닉네임으로 보여요
        {g.join_until ? `\n참여 신청 마감: ${Number(g.join_until.slice(5, 7))}/${Number(g.join_until.slice(8))} 23:59` : ''}
      </AppText>
      {full ? (
        <AppText variant="label" color={color.danger}>
          정원이 다 찼어요
        </AppText>
      ) : (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <TextInput
            accessibilityLabel={`${g.name} 비밀번호`}
            value={pw}
            onChangeText={(t) => setPw(t.slice(0, 20))}
            placeholder="비밀번호"
            placeholderTextColor={color.inkFaint}
            keyboardType="number-pad"
            secureTextEntry
            onSubmitEditing={join}
            style={{ ...inputStyle, minHeight: 48, flex: 1, minWidth: 0 }}
          />
          <Button label={busy ? '…' : '참여'} disabled={busy || !pw} onPress={join} style={{ minWidth: 88 }} />
        </View>
      )}
      {err ? (
        <View style={{ gap: space.sm }}>
          <AppText variant="caption" color={color.danger}>
            {err}
          </AppText>
          {/닉네임/.test(err) ? <Button label="닉네임 정하기" variant="soft" onPress={() => router.push('/settings/nickname')} /> : null}
        </View>
      ) : null}
    </Card>
  );
}
