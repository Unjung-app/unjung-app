import { useState } from 'react';
import { Platform, Pressable, Share, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button, Card } from '@/components/ui/primitives';
import { Segmented } from '@/components/ui/Segmented';
import { Screen } from '@/components/ui/Screen';
import { inputStyle } from '@/features/voice/ui';
import { useAuth } from '@/state/auth';
import { color, radius, space } from '@/theme/tokens';
import { call, hm, hms, useGroupAdmin, type AdminBoard, type AdminMember } from './api';

type Sort = 'period' | 'days' | 'no';

/**
 * 교육활동부(스터디 윗미 관리자) 화면: 실명·학번 · 기간 누적 · 참여일 · 날짜별 시간.
 * 시상 선정용으로 엑셀에서 열 수 있는 CSV로 내보낼 수 있다.
 */
export function StudyAdminScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gid = Number(id) || 0;
  const { status } = useAuth();
  const a = useGroupAdmin(gid, status === 'ready');
  const [sort, setSort] = useState<Sort>('period');
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [until, setUntil] = useState('');

  const g = a.data;
  if (!g) {
    return (
      <Screen topInset={false} onRefresh={a.reload}>
        <AppText variant="body" color={a.error ? color.danger : color.inkMuted}>
          {a.error ?? '불러오는 중…'}
        </AppText>
      </Screen>
    );
  }

  const rows = sorted(g.members, sort);
  const sincere = g.members.filter((m) => m.days >= 1).length;
  const liveCount = g.members.filter((m) => m.live).length;

  return (
    <Screen topInset={false} onRefresh={a.reload}>
      <Card tone="navy" style={{ gap: 4 }}>
        <AppText variant="heading" color={color.onNavy} style={{ fontSize: 20, lineHeight: 28 }}>
          {g.name}
        </AppText>
        <AppText variant="caption" color={color.onNavySub}>
          기간 {g.starts_on} ~ {g.ends_on} · 비밀번호 {g.password}
        </AppText>
        <AppText variant="label" color={color.onNavy} style={{ marginTop: space.sm }}>
          멤버 {g.members.length}/{g.capacity}명 · 지금 {liveCount}명 공부 중 · 1일 이상 참여 {sincere}명
        </AppText>
      </Card>

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button label="CSV로 내보내기 (엑셀)" style={{ flex: 1 }} onPress={async () => setMsg(await exportCsv(g))} />
        <Button label="새로 고침" variant="soft" onPress={a.reload} />
      </View>
      {msg ? (
        <AppText variant="caption" color={color.inkMuted}>
          {msg}
        </AppText>
      ) : null}

      <Segmented<Sort>
        label="정렬"
        value={sort}
        onChange={setSort}
        options={[
          { value: 'period', label: '누적 시간' },
          { value: 'days', label: '참여일' },
          { value: 'no', label: '학번' },
        ]}
      />

      <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <AppText variant="body" color={color.inkMuted} style={{ padding: space.lg }}>
            아직 들어온 학생이 없어요.
          </AppText>
        ) : null}
        {rows.map((m, i) => {
          const on = open === m.user_id;
          return (
            <View key={m.user_id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: color.lineSoft }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: on }}
                accessibilityLabel={`${i + 1}. ${m.student_no ?? ''} ${m.name ?? ''}, 누적 ${hm(m.period_seconds)}, 참여 ${m.days}일, 날짜별 보기`}
                onPress={() => setOpen(on ? null : m.user_id)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: space.lg, gap: space.sm, backgroundColor: pressed ? color.surfaceMuted : color.surface })}>
                <AppText variant="label" color={color.inkMuted} style={{ width: 24 }}>
                  {i + 1}
                </AppText>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.live ? color.success : color.line }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {m.student_no ?? '-'} {m.name ?? '(학적 없음)'}
                  </AppText>
                  <AppText variant="caption" color={color.inkMuted} numberOfLines={1}>
                    {m.nickname ?? '-'} · 참여 {m.days}일 · 오늘 {hm(m.today_seconds)}
                  </AppText>
                </View>
                <AppText variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
                  {hms(m.period_seconds)}
                </AppText>
              </Pressable>
              {on ? <Detail g={g} m={m} onRemoved={a.reload} /> : null}
            </View>
          );
        })}
      </View>

      <Card tone="muted" style={{ gap: space.sm }}>
        <AppText variant="label">그룹 설정</AppText>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <TextInput
            accessibilityLabel="새 비밀번호"
            value={pw}
            onChangeText={(t) => setPw(t.slice(0, 20))}
            placeholder="새 비밀번호"
            placeholderTextColor={color.inkFaint}
            style={{ ...inputStyle, minHeight: 48, flex: 1, minWidth: 0 }}
          />
          <Button
            label="바꾸기"
            disabled={!pw.trim()}
            onPress={async () => {
              const e = await call('manage_study_group', { p_id: g.id, p_password: pw, p_capacity: null, p_starts: null, p_ends: null, p_closed: null });
              setMsg(e ?? '비밀번호를 바꿨어요. 이미 들어온 학생은 그대로예요.');
              setPw('');
              a.reload();
            }}
          />
        </View>
        <AppText variant="caption" color={color.inkMuted}>
          참여 신청 마감: {g.join_until ? `${g.join_until} 23:59까지` : '없음(기간 중 언제든)'}
        </AppText>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <TextInput
            accessibilityLabel="새 참여 마감일"
            value={until}
            onChangeText={(t) => setUntil(t.replace(/[^0-9-]/g, '').slice(0, 10))}
            placeholder="예) 2026-11-10 (비우면 마감 없음)"
            placeholderTextColor={color.inkFaint}
            style={{ ...inputStyle, minHeight: 48, flex: 1, minWidth: 0 }}
          />
          <Button
            label="마감 바꾸기"
            variant="soft"
            disabled={!!until && !/^2026-1[12]-\d{2}$/.test(until)}
            onPress={async () => {
              const e = await call('set_study_join_until', { p_id: g.id, p_date: until || null });
              setMsg(e ?? (until ? `참여 마감을 ${until}로 바꿨어요.` : '참여 마감을 없앴어요.'));
              setUntil('');
              a.reload();
            }}
          />
        </View>
        <AppText variant="caption" color={color.inkMuted}>
          참여일 = 하루 30분 이상 공부한 날. 시간은 수업 시간에 잰 것까지 포함해요(서버가 1분 신호로 센 시간, 하루 랭킹 인정 12시간 상한).
        </AppText>
      </Card>
    </Screen>
  );
}

function Detail({ g, m, onRemoved }: { g: AdminBoard; m: AdminMember; onRemoved: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const days = g.days.filter((d) => d <= g.today);
  return (
    <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.sm, backgroundColor: color.surfaceMuted }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: space.sm }}>
        {days.length === 0 ? (
          <AppText variant="caption" color={color.inkMuted}>
            아직 집계 기간 전이에요.
          </AppText>
        ) : null}
        {days.map((d) => {
          const s = m.by_day[d] ?? 0;
          return (
            <View key={d} style={{ minWidth: 72, padding: 6, borderRadius: radius.chip, backgroundColor: s >= 1800 ? color.successSoft : color.surface }}>
              <AppText variant="caption" color={color.inkMuted}>
                {d.slice(5).replace('-', '/')}
              </AppText>
              <AppText variant="label" color={s >= 1800 ? color.success : color.ink}>
                {hm(s)}
              </AppText>
            </View>
          );
        })}
      </View>
      {confirm ? (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="취소" variant="soft" style={{ flex: 1 }} onPress={() => setConfirm(false)} />
          <Button
            label="내보내기 확인"
            style={{ flex: 1, backgroundColor: color.danger }}
            onPress={async () => {
              const e = await call('manage_study_member', { p_group: g.id, p_user: m.user_id });
              if (e) setErr(e);
              else onRemoved();
            }}
          />
        </View>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel={`${m.name ?? ''} 그룹에서 내보내기`} onPress={() => setConfirm(true)} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
          <AppText variant="label" color={color.danger}>
            그룹에서 내보내기
          </AppText>
        </Pressable>
      )}
      {err ? (
        <AppText variant="caption" color={color.danger}>
          {err}
        </AppText>
      ) : null}
    </View>
  );
}

function sorted(ms: AdminMember[], sort: Sort) {
  const r = [...ms];
  if (sort === 'no') return r.sort((a, b) => (a.student_no ?? '').localeCompare(b.student_no ?? ''));
  if (sort === 'days') return r.sort((a, b) => b.days - a.days || b.period_seconds - a.period_seconds);
  return r.sort((a, b) => b.period_seconds - a.period_seconds);
}

/** 엑셀에서 한글이 깨지지 않게 BOM을 붙인 CSV. 시간은 분 단위 */
export function toCsv(g: AdminBoard) {
  const esc = (v: string | number | null) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ['순위', '학번', '이름', '닉네임', '기간 누적(분)', '참여일(30분 이상)', ...g.days.map((d) => `${d.slice(5)}(분)`)];
  const lines = sorted(g.members, 'period').map((m, i) => [i + 1, m.student_no, m.name, m.nickname, Math.floor(m.period_seconds / 60), m.days, ...g.days.map((d) => Math.floor((m.by_day[d] ?? 0) / 60))]);
  return '﻿' + [head, ...lines].map((r) => r.map(esc).join(',')).join('\n');
}

async function exportCsv(g: AdminBoard): Promise<string> {
  const csv = toCsv(g);
  const file = `${g.name.replace(/\s+/g, '_')}_${g.today}.csv`;
  try {
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = file;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return `${file} 파일을 내려받았어요. 실명·학번이 들어 있으니 행사가 끝나면 지워 주세요.`;
    }
    await Share.share({ title: file, message: csv });
    return '공유 창을 열었어요. 실명·학번이 들어 있으니 행사가 끝나면 지워 주세요.';
  } catch {
    return '내보내지 못했어요. 잠시 뒤 다시 시도해 주세요.';
  }
}
