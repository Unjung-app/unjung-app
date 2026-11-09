import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Badge, Button, Card, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { supabase } from '@/lib/supabase';
import { useStaffAccess } from '@/features/admin/access';
import { color, radius, space } from '@/theme/tokens';
import { GAME_IDS, GAMES, listBuilds, preview, reviewBuild, submitBuild, unpublishBuild, useLiveBuilds, type BuildRow, type GameMeta } from './data';
import { checkGame } from './inject';

/** 개발자가 AI 채팅을 시작할 때 붙여 넣는 규칙 */
export const AI_RULES = `[운중고 앱 게임 규칙 — 이 규칙을 지켜서 만들어 줘]
1. HTML 파일 하나로 만들어 줘. 그림·소리는 코드로 그리거나 파일 안에 넣고, 외부 사이트의 파일·글꼴은 쓰지 마.
2. 휴대폰 세로 화면에서 터치로 조작할 수 있게, 화면 크기에 맞춰 늘어나게 해 줘.
3. 한 판이 끝나면 점수(정수)를 이렇게 보내 줘: window.UnjungGame && UnjungGame.submitScore(점수);
4. 저장이 필요하면 localStorage를 그대로 써도 돼.
5. 게임 안 화폐에 🪙 기호는 쓰지 마(앱 토큰과 헷갈려).
6. 코드를 고칠 때는 바뀐 부분만 말고 항상 전체 코드를 처음부터 끝까지 보여 줘.`;

const STATUS: Record<BuildRow['status'], { label: string; tone: 'accent' | 'muted' | 'success' }> = {
  pending: { label: '검토 대기', tone: 'accent' },
  live: { label: '앱에 반영됨', tone: 'success' },
  old: { label: '예전 버전', tone: 'muted' },
  rejected: { label: '반려', tone: 'muted' },
};

/** 게임 제출함: 개발자는 전체 코드를 붙여 넣어 제출, 관리자는 미리 플레이 → 승인·반려·되돌리기 */
export function DevGamesScreen() {
  const router = useRouter();
  const { admin, staff, checked } = useStaffAccess();
  const lives = useLiveBuilds(staff) ?? [];
  const ids = useMemo(() => [...GAME_IDS, ...lives.map((b) => b.game).filter((g) => !GAMES[g])], [lives]);
  const [game, setGame] = useState<string>('');
  const [isNew, setIsNew] = useState(false);
  const [meta, setMeta] = useState<GameMeta>({});
  const [html, setHtml] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<BuildRow[] | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [reason, setReason] = useState<Record<string, string>>({});

  const load = useCallback(async () => setRows(await listBuilds()), []);
  useEffect(() => {
    if (staff) load();
  }, [staff, load]);

  const checks = html ? checkGame(html) : [];
  const gameId = game;
  const blocked = checks.some((c) => !c.ok && !c.warn);
  const titleOf = (g: string) => GAMES[g]?.title ?? lives.find((b) => b.game === g)?.meta.title ?? g;

  const pickFile = () => {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html,.htm,text/html';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (f) setHtml(await f.text());
    };
    input.click();
  };

  const playPreview = (code: string, title: string, id: string) => {
    preview.html = code;
    preview.title = title;
    router.push(`/game/${id || 'preview'}?preview=1`);
  };

  const submit = async () => {
    setMsg(null);
    if (!gameId) return setMsg(isNew ? '새 게임 id를 적어 주세요(영문 소문자)' : '어떤 게임인지 골라 주세요');
    if (isNew && !meta.title) return setMsg('새 게임 이름을 적어 주세요');
    setBusy(true);
    const r = await submitBuild(gameId, html, isNew ? meta : {}, note);
    setBusy(false);
    if (!r.ok) return setMsg(r.message);
    setMsg('제출했어요! 관리자가 미리 플레이해 보고 승인하면 바로 앱에 반영돼요.');
    setHtml('');
    setNote('');
    load();
  };

  const act = async (f: Promise<string | null>, ok: string) => {
    const e = await f;
    setMsg(e ?? ok);
    load();
  };

  const openCode = async (b: BuildRow) => {
    const { data, error } = await supabase.rpc('game_build_html', { p_id: b.id });
    if (error || typeof data !== 'string') return setMsg('코드를 불러오지 못했어요');
    playPreview(data, `${titleOf(b.game)} (제출본)`, b.game);
  };

  if (!staff) {
    return (
      <Screen topInset={false}>
        <AppText variant="body">{checked ? '개발자·관리자만 쓸 수 있어요.' : '확인하는 중…'}</AppText>
      </Screen>
    );
  }

  const pending = (rows ?? []).filter((b) => b.status === 'pending');

  return (
    <Screen topInset={false} onRefresh={load}>
      <Card style={{ gap: space.sm }}>
        <AppText variant="heading">🎮 게임 올리기</AppText>
        <AppText variant="body" color={color.inkMuted}>
          AI가 준 전체 코드를 붙여 넣고 제출하면 끝이에요. 앱 연결 코드는 앱이 알아서 넣어요.
        </AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="AI에게 줄 규칙 보기" onPress={() => setShowRules((v) => !v)} style={{ minHeight: 44, justifyContent: 'center' }}>
          <AppText variant="label" color={color.accent}>
            {showRules ? '▾' : '▸'} AI 채팅을 시작할 때 붙여 넣을 규칙
          </AppText>
        </Pressable>
        {showRules ? (
          <View style={{ backgroundColor: color.surfaceMuted, borderRadius: radius.control, padding: space.md, gap: space.sm }}>
            <AppText variant="caption" color={color.ink} style={{ lineHeight: 19 }}>
              {AI_RULES}
            </AppText>
            {Platform.OS === 'web' ? (
              <Button label="규칙 복사" variant="soft" onPress={() => navigator.clipboard?.writeText(AI_RULES).then(() => setMsg('규칙을 복사했어요'))} />
            ) : null}
          </View>
        ) : null}

        <AppText variant="label">어떤 게임인가요?</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {ids.map((g) => (
            <Choice key={g} label={titleOf(g)} on={!isNew && game === g} onPress={() => { setIsNew(false); setGame(g); }} />
          ))}
          <Choice label="＋ 새 게임" on={isNew} onPress={() => { setIsNew(true); setGame(''); }} />
        </View>
        {isNew ? (
          <View style={{ gap: space.sm }}>
            <Field label="게임 id (영문 소문자·숫자, 바꿀 수 없어요)" value={game} onChange={(v) => setGame(v.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30))} placeholder="예: space_jump" />
            <Field label="게임 이름" value={meta.title ?? ''} onChange={(v) => setMeta({ ...meta, title: v })} placeholder="예: 우주 점프" />
            <Field label="이모지 하나" value={meta.emoji ?? ''} onChange={(v) => setMeta({ ...meta, emoji: v })} placeholder="🚀" />
            <Field label="한 줄 소개" value={meta.desc ?? ''} onChange={(v) => setMeta({ ...meta, desc: v })} />
            <Field label="조작법 한 줄" value={meta.how ?? ''} onChange={(v) => setMeta({ ...meta, how: v })} />
            <Field label="만든 사람" value={meta.by ?? ''} onChange={(v) => setMeta({ ...meta, by: v })} placeholder="이름(여러 명이면 쉼표)" />
          </View>
        ) : null}

        <AppText variant="label">게임 코드</AppText>
        {Platform.OS === 'web' ? <Button label="📂 HTML 파일 고르기" variant="soft" onPress={pickFile} /> : null}
        <TextInput
          accessibilityLabel="게임 전체 코드 붙여넣기"
          value={html.length > 4000 ? html.slice(0, 4000) + '\n…(이하 생략, 전체가 들어 있어요)' : html}
          onChangeText={(t) => setHtml(t)}
          multiline
          placeholder="또는 여기에 <!DOCTYPE html> 부터 </html> 까지 전체 코드를 붙여 넣기"
          placeholderTextColor={color.inkFaint}
          style={{ minHeight: 110, maxHeight: 180, borderWidth: 1, borderColor: color.line, borderRadius: radius.control, padding: space.md, fontSize: 12, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, color: color.ink, backgroundColor: color.surface }}
        />
        {html ? (
          <View style={{ gap: 4 }}>
            {checks.map((c, i) => (
              <AppText key={i} variant="caption" color={c.ok && !c.warn ? color.inkMuted : c.ok || c.warn ? color.accent : color.danger}>
                {c.ok && !c.warn ? '✅' : c.warn ? '⚠️' : '❌'} {c.text}
              </AppText>
            ))}
            <Button label="✕ 코드 지우기" variant="ghost" onPress={() => setHtml('')} />
          </View>
        ) : null}
        <Field label="무엇을 바꿨나요? (관리자에게 보여요)" value={note} onChange={setNote} placeholder="예: 3스테이지 난이도 낮춤, 버그 수정" />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="🧪 미리 플레이" variant="soft" disabled={!html || blocked} onPress={() => playPreview(html, isNew ? meta.title || '새 게임' : titleOf(game), gameId)} style={{ flex: 1 }} />
          <Button label={busy ? '보내는 중…' : '제출'} disabled={!html || blocked || busy} onPress={submit} style={{ flex: 1 }} />
        </View>
        {msg ? (
          <AppText variant="label" color={color.accent}>
            {msg}
          </AppText>
        ) : null}
      </Card>

      {admin && pending.length ? <SectionTitle title={`검토 대기 ${pending.length}`} /> : null}
      <SectionTitle title={admin ? '모든 제출' : '내 제출'} />
      {rows === null ? (
        <AppText variant="body" color={color.inkMuted}>
          불러오는 중…
        </AppText>
      ) : rows.length === 0 ? (
        <AppText variant="body" color={color.inkMuted}>
          아직 제출한 게임이 없어요.
        </AppText>
      ) : (
        [...pending, ...rows.filter((b) => b.status !== 'pending')].map((b) => (
          <Card key={b.id} style={{ gap: space.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <AppText variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                {b.meta?.emoji ?? GAMES[b.game]?.emoji ?? '🎮'} {titleOf(b.game)}
              </AppText>
              <Badge label={STATUS[b.status].label} tone={STATUS[b.status].tone} />
            </View>
            <AppText variant="caption" color={color.inkMuted}>
              {b.author_name ?? '알 수 없음'} · {new Date(b.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {Math.round(b.size / 1024)}KB
            </AppText>
            {b.note ? <AppText variant="body">“{b.note}”</AppText> : null}
            {b.reject_reason ? (
              <AppText variant="label" color={color.danger}>
                반려 사유: {b.reject_reason}
              </AppText>
            ) : null}
            {(admin || b.mine) && b.status !== 'live' ? <Button label="🧪 미리 플레이" variant="soft" onPress={() => openCode(b)} /> : null}
            {admin && b.status === 'pending' ? (
              <>
                <Button label="✅ 승인 — 바로 앱에 반영" onPress={() => act(reviewBuild(b.id, true), '반영했어요')} />
                <Field label="반려 사유" value={reason[b.id] ?? ''} onChange={(v) => setReason({ ...reason, [b.id]: v })} placeholder="예: 화면이 잘려요" />
                <Button label="반려" variant="ghost" onPress={() => act(reviewBuild(b.id, false, reason[b.id] ?? ''), '반려했어요')} />
              </>
            ) : null}
            {admin && b.status === 'old' ? <Button label="↩️ 이 버전으로 되돌리기" variant="soft" onPress={() => act(reviewBuild(b.id, true), '되돌렸어요')} /> : null}
            {admin && b.status === 'live' ? <Button label="내리기 (앱 기본판으로)" variant="ghost" onPress={() => act(unpublishBuild(b.game), '내렸어요')} /> : null}
          </Card>
        ))
      )}
    </Screen>
  );
}

function Choice({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={{ minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.round, borderWidth: 1, borderColor: on ? color.accent : color.line, backgroundColor: on ? color.accentSoft : color.surface, justifyContent: 'center' }}>
      <AppText variant="label" color={on ? color.accent : color.ink}>
        {label}
      </AppText>
    </Pressable>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <AppText variant="caption" color={color.inkMuted}>
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={color.inkFaint}
        style={{ minHeight: 44, borderWidth: 1, borderColor: color.line, borderRadius: radius.control, paddingHorizontal: space.md, color: color.ink, backgroundColor: color.surface }}
      />
    </View>
  );
}
