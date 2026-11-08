import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/primitives';
import { supabase } from '@/lib/supabase';
import { color, radius, space } from '@/theme/tokens';

type Comment = {
  id: number;
  body: string;
  nickname: string | null;
  mine: boolean;
  name: string | null;
  student_no: string | null;
};

export function LostComments({ itemId, admin }: { itemId: number; admin: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [writeError, setWriteError] = useState('');

  const load = async () => {
    setLoadError(false);
    const { data, error } = await supabase.rpc('read_lost_comments', { p_item_id: itemId, p_admin: admin });
    if (error) setLoadError(true);
    else setComments(((data ?? []) as Comment[]).reverse());
  };
  const submit = async () => {
    if (busy || !confirmed || !draft.trim()) return;
    setBusy(true);
    setWriteError('');
    try {
      const { error } = await supabase.rpc('post_lost_comment', {
        p_item_id: itemId, p_body: draft.trim(), p_confirmed: confirmed,
      });
      if (error) {
        setWriteError(/[가-힣]/.test(error.message) ? error.message : '댓글을 올리지 못했어요. 다시 시도해 주세요.');
        return;
      }
      setDraft('');
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ borderTopWidth: 1, borderColor: color.line, paddingTop: space.sm, gap: space.sm }}>
      <Button label={open ? '댓글 접기' : '댓글 보기·쓰기'} accessibilityLabel={open ? '댓글 접기' : '댓글 보기 및 쓰기'}
        variant="ghost" onPress={() => { setOpen(!open); if (!open) void load(); }} />
      {open ? (
        <>
          {loadError ? (
            <Button label="댓글 다시 불러오기" accessibilityLabel="댓글 다시 불러오기" variant="soft" onPress={load} />
          ) : comments?.length ? comments.map((comment) => (
            <View key={comment.id} style={{ padding: space.sm, borderRadius: radius.control, backgroundColor: color.surfaceMuted }}>
              <AppText variant="caption" color={color.inkMuted}>
                {comment.mine ? '나' : comment.nickname || '학생'}
                {admin ? ` · ${comment.name ?? '학적 정보 없음'}${comment.student_no ? ` (${comment.student_no})` : ''}` : ''}
              </AppText>
              <AppText variant="body">{comment.body}</AppText>
            </View>
          )) : (
            <AppText variant="caption" color={color.inkMuted}>{comments ? '아직 댓글이 없어요.' : '댓글을 불러오는 중이에요.'}</AppText>
          )}
          {confirmed ? (
            <>
              <TextInput accessibilityLabel="댓글 내용" placeholder="댓글을 입력하세요" placeholderTextColor={color.inkFaint}
                multiline maxLength={300} value={draft} onChangeText={setDraft} editable={!busy}
                style={{ minHeight: 44, padding: space.sm, borderWidth: 1, borderColor: color.line, borderRadius: radius.control, color: color.ink }} />
              <Button label={busy ? '올리는 중…' : '댓글 올리기'} accessibilityLabel="댓글 올리기" disabled={busy || !draft.trim()} onPress={submit} />
              {writeError ? <AppText variant="caption" color={color.danger} accessibilityRole="alert">{writeError}</AppText> : null}
            </>
          ) : (
            <>
              <AppText variant="caption" color={color.inkMuted}>부적절한 댓글은 영구정지의 대상이 될 수 있습니다</AppText>
              <Button label="확인" accessibilityLabel="댓글 작성 안내 확인" variant="soft" onPress={() => setConfirmed(true)} />
            </>
          )}
        </>
      ) : null}
    </View>
  );
}
