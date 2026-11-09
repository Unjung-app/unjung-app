import { useCallback, useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { supabase } from '@/lib/supabase';
import { fontStyle } from '@/theme/fonts';
import { color, radius, space } from '@/theme/tokens';

type Teacher = { email: string; name: string; admin: boolean; joined: boolean };
const friendly = (m?: string) => (m && /[가-힣]/.test(m) ? m : '처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.');

/**
 * 관리자: 선생님 계정 명단.
 * 학교 구글 이메일을 넣어 두면 그 선생님은 학번 등록 없이 로그인되고 '선생님' 배지가 붙는다.
 * '관리자 권한'을 켜면 관리자 기능 전부(학생 관리·검토·의견 관리·사용 현황·설문)를 쓴다.
 */
export function TeacherAdmin({ onChanged }: { onChanged?: () => void }) {
  const [list, setList] = useState<Teacher[] | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [admin, setAdmin] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('admin_list_teachers');
    setList((data as Teacher[]) ?? []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: string, args: Record<string, unknown>, okText: string) => {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    setMsg(error ? { ok: false, text: friendly(error.message) } : { ok: true, text: okText });
    if (!error) {
      await load();
      onChanged?.();
    }
    return !error;
  };

  const input = { borderWidth: 1, borderColor: color.line, borderRadius: radius.control, paddingHorizontal: space.md, minHeight: 48, fontSize: 15, color: color.ink, backgroundColor: color.surface, ...fontStyle('regular') } as const;
  const ready = /^[a-z0-9._-]+@unjung\.hs\.kr$/i.test(email.trim()) && name.trim().length >= 2;

  return (
    <Card style={{ gap: space.sm }}>
      <AppText variant="label">👩‍🏫 선생님 계정</AppText>
      <AppText variant="caption" color={color.inkMuted}>
        선생님의 학교 구글 이메일을 넣어 두면, 선생님은 학번 등록 없이 로그인하고 &apos;선생님&apos; 배지가 붙어요. 선생님 공지는 검토 없이 바로 게시돼요. 학생 계정(숫자 아이디)은 넣을 수 없어요.
      </AppText>
      {(list ?? []).map((t) => (
        <View key={t.email} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, borderTopWidth: 1, borderTopColor: color.lineSoft, paddingTop: space.xs }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="bodyStrong">{t.name} 선생님</AppText>
            <AppText variant="caption" color={color.inkFaint} numberOfLines={1}>
              {t.email} · {t.joined ? '로그인함' : '아직 로그인 전'}
            </AppText>
          </View>
          {t.admin ? <Badge label="관리자" tone="accent" /> : <Badge label="배지만" tone="muted" />}
          {removing === t.email ? (
            <Button label="정말 빼기" variant="ghost" disabled={busy} onPress={async () => (await run('admin_remove_teacher', { p_email: t.email }, `${t.name} 선생님을 명단에서 뺐어요`), setRemoving(null))} />
          ) : (
            <Button label="빼기" variant="ghost" onPress={() => setRemoving(t.email)} />
          )}
        </View>
      ))}
      <TextInput accessibilityLabel="선생님 학교 이메일" value={email} onChangeText={(v) => setEmail(v.trim().slice(0, 60))} placeholder="예) teacher@unjung.hs.kr" placeholderTextColor={color.inkFaint} autoCapitalize="none" keyboardType="email-address" style={input} />
      <TextInput accessibilityLabel="선생님 이름" value={name} onChangeText={(v) => setName(v.slice(0, 10))} placeholder="이름 (예: 박경애)" placeholderTextColor={color.inkFaint} style={input} />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: admin }}
        accessibilityLabel="관리자 권한 함께 주기"
        onPress={() => setAdmin((v) => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 }}>
        <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: color.navy, backgroundColor: admin ? color.navy : color.surface, alignItems: 'center', justifyContent: 'center' }}>
          {admin ? (
            <AppText variant="caption" color={color.onNavy}>
              ✓
            </AppText>
          ) : null}
        </View>
        <AppText variant="body">관리자 권한 함께 주기</AppText>
      </Pressable>
      <Button label={busy ? '…' : '선생님 추가'} disabled={!ready || busy} onPress={async () => {
        if (await run('admin_add_teacher', { p_email: email.trim().toLowerCase(), p_name: name.trim(), p_admin: admin }, `${name.trim()} 선생님을 추가했어요. 학교 계정으로 로그인하시면 바로 적용돼요`)) {
          setEmail('');
          setName('');
        }
      }} />
      {msg ? (
        <AppText variant="label" weight="regular" color={msg.ok ? color.success : color.danger}>
          {msg.text}
        </AppText>
      ) : null}
    </Card>
  );
}
