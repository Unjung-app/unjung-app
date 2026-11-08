import { useState } from 'react';
import { Platform, TextInput, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button, Card } from '@/components/ui/primitives';
import { supabase } from '@/lib/supabase';
import { fontStyle } from '@/theme/fonts';
import { color, radius, space } from '@/theme/tokens';

type Item = { id: number; status: 'new' | 'seen' | 'done' | 'wontfix'; reply?: string };
const STATUSES = ['new', 'seen', 'done', 'wontfix'];

/**
 * 관리자: 리드 에이전트(Claude)와 의견을 주고받는 통로. 비밀 키 없이 복사·붙여넣기만으로 한다.
 *  1) 'AI 검토용 복사' → 처리할 의견을 짧은 글로 복사 → 대화창에 붙여 넣는다
 *  2) 에이전트가 고친 뒤 주는 결과(JSON)를 '결과 붙여넣기'에 넣고 적용 → 상태·답변 일괄 반영(반영 완료면 토큰 자동 지급)
 */
export function AiRelay({ onApplied }: { onApplied: () => void }) {
  const [open, setOpen] = useState<'none' | 'export' | 'import'>('none');
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const doExport = async () => {
    setBusy(true);
    setNote(null);
    const { data, error } = await supabase
      .from('feedback_admin')
      .select('id, kind, body, screen, status, reply, created_at, grade')
      .in('status', ['new', 'seen'])
      .order('created_at', { ascending: true })
      .limit(300);
    setBusy(false);
    if (error) return setNote('불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.');
    const rows = (data ?? []) as { id: number; kind: string; body: string; screen: string | null; status: string; reply: string | null; created_at: string; grade: number | null }[];
    const out = [
      `[운중고 앱 의견 ${rows.length}개 · ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} 기준 · 처리할 것만]`,
      ...rows.map(
        (r) =>
          `#${r.id} [${r.kind}/${r.status}] ${r.created_at.slice(5, 10)}${r.grade ? ` ${r.grade}학년` : ''}${r.screen ? ` @${r.screen}` : ''} :: ${r.body.replace(/\s+/g, ' ')}${r.reply ? ` || 답변: ${r.reply.replace(/\s+/g, ' ')}` : ''}`,
      ),
    ].join('\n');
    setText(out);
    setOpen('export');
    try {
      if (Platform.OS === 'web') await navigator.clipboard.writeText(out);
      setNote(`${rows.length}개를 복사했어요. Claude 대화창에 붙여 넣어 주세요.`);
    } catch {
      setNote('자동 복사가 막혔어요. 아래 글을 길게 눌러 전체 선택 → 복사해 주세요.');
    }
  };

  const parse = (): Item[] | string => {
    const s = text.indexOf('['), e = text.lastIndexOf(']');
    if (s < 0 || e <= s) return 'Claude가 준 결과 코드( [ 로 시작 )를 붙여 넣어 주세요.';
    try {
      const arr = JSON.parse(text.slice(s, e + 1)) as unknown[];
      const items = arr.filter(
        (x): x is Item => !!x && typeof (x as Item).id === 'number' && STATUSES.includes((x as Item).status) && ((x as Item).reply === undefined || typeof (x as Item).reply === 'string'),
      );
      if (!items.length) return '적용할 항목이 없어요.';
      if (items.length !== arr.length) return `형식이 맞지 않는 항목이 ${arr.length - items.length}개 있어요. 결과 코드를 다시 받아 주세요.`;
      return items;
    } catch {
      return '결과 코드 형식이 맞지 않아요. 잘리지 않게 전부 복사했는지 확인해 주세요.';
    }
  };

  const doImport = async () => {
    const items = parse();
    if (typeof items === 'string') return setNote(items);
    setBusy(true);
    let ok = 0;
    const fails: string[] = [];
    for (const it of items) {
      const { error } = await supabase.rpc('admin_update_feedback', { p_id: it.id, p_status: it.status, p_reply: it.reply ?? '' });
      if (error) fails.push(`#${it.id}`);
      else ok++;
    }
    setBusy(false);
    setNote(`${ok}개 반영했어요.${fails.length ? ` 실패: ${fails.join(', ')} (이미 지워졌거나 권한 문제)` : ''}`);
    if (!fails.length) setText('');
    onApplied();
  };

  return (
    <Card tone="muted" style={{ gap: space.sm }}>
      <AppText variant="bodyStrong">🤖 Claude와 함께 검토</AppText>
      <AppText variant="caption" color={color.inkMuted}>
        ① 처리할 의견을 복사해 대화창에 붙여 넣기 → ② Claude가 고친 뒤 주는 결과 코드를 붙여 넣고 적용(답변·반영 완료·토큰이 한꺼번에 처리돼요)
      </AppText>
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <Button label={busy && open !== 'import' ? '복사하는 중…' : '① AI 검토용 복사'} variant="soft" disabled={busy} onPress={doExport} />
        <Button
          label="② 결과 붙여넣기"
          variant="soft"
          disabled={busy}
          onPress={() => {
            setOpen('import');
            setText('');
            setNote(null);
          }}
        />
      </View>
      {open !== 'none' ? (
        <TextInput
          accessibilityLabel={open === 'export' ? '복사할 의견 글' : 'Claude 결과 코드'}
          value={text}
          onChangeText={open === 'import' ? setText : undefined}
          editable={open === 'import'}
          multiline
          placeholder={open === 'import' ? 'Claude가 준 결과 코드를 여기에 붙여 넣어 주세요' : ''}
          placeholderTextColor={color.inkFaint}
          style={{ minHeight: 120, maxHeight: 260, borderWidth: 1, borderColor: color.line, borderRadius: radius.control, padding: space.md, fontSize: 12, color: color.ink, backgroundColor: color.surface, textAlignVertical: 'top', ...fontStyle('regular') }}
        />
      ) : null}
      {open === 'import' ? <Button label={busy ? '적용하는 중…' : '적용하기'} disabled={busy || !text.trim()} onPress={doImport} /> : null}
      {note ? (
        <AppText variant="caption" color={/못|막혔|않|실패|없어요/.test(note) ? color.danger : color.success}>
          {note}
        </AppText>
      ) : null}
    </Card>
  );
}
