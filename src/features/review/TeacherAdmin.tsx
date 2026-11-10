import { useCallback, useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { supabase } from '@/lib/supabase';
import { fontStyle } from '@/theme/fonts';
import { color, radius, space } from '@/theme/tokens';

type Account = { user_id: string; email: string; name: string; admin: boolean; blocked: boolean; home: string | null; dept: string | null; me: boolean };
type Pending = { email: string; name: string; admin: boolean };
const friendly = (m?: string) => (m && /[가-힣]/.test(m) ? m : '처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.');

/**
 * 관리자: 선생님 계정.
 *  · 앞 5자리가 숫자가 아닌 학교 계정은 처음 로그인할 때 이름을 쓰면 자동으로 선생님(승인 없음)
 *  · 여기서: 선생님 계정에 관리자 권한 주기/빼기, 공용·행정 계정 '해제', 로그인 전 미리 관리자로 지정
 */
export function TeacherAdmin({ onChanged }: { onChanged?: () => void }) {
  const [list, setList] = useState<{ accounts: Account[]; pending: Pending[] } | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [admin, setAdmin] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('admin_list_teachers');
    setList((data as { accounts: Account[]; pending: Pending[] }) ?? { accounts: [], pending: [] });
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
        숫자로 시작하지 않는 학교 계정(@unjung.hs.kr)은 처음 로그인할 때 이름을 쓰면 바로 선생님 계정이 돼요. 여기서는 관리자 권한을 드리거나, 선생님이 아닌 공용·행정 계정을 해제해요.
      </AppText>
      {(list?.accounts ?? []).map((t) => (
        <View key={t.user_id} style={{ gap: space.xs, borderTopWidth: 1, borderTopColor: color.lineSoft, paddingTop: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="bodyStrong" color={t.blocked ? color.inkFaint : color.ink}>
                {t.blocked ? `${t.email.split('@')[0]} (해제됨)` : `${t.name} 선생님`}
              </AppText>
              <AppText variant="caption" color={color.inkFaint} numberOfLines={1}>
                {[t.email, t.home ? `${t.home} 담임` : null, t.dept].filter(Boolean).join(' · ')}
              </AppText>
            </View>
            {t.blocked ? null : t.admin ? <Badge label="관리자" tone="accent" /> : <Badge label="선생님" tone="muted" />}
          </View>
          {t.me ? null : (
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {t.blocked ? (
                <Button label="해제 풀기" variant="soft" disabled={busy} onPress={() => run('admin_block_teacher', { p_user: t.user_id, p_block: false }, '해제를 풀었어요. 다시 로그인하면 선생님 정보를 쓸 수 있어요')} />
              ) : (
                <>
                  <Button
                    label={t.admin ? '관리자 권한 빼기' : '관리자 권한 주기'}
                    variant="soft"
                    disabled={busy}
                    onPress={() => run('admin_set_teacher_admin', { p_user: t.user_id, p_admin: !t.admin }, t.admin ? `${t.name} 선생님의 관리자 권한을 뺐어요` : `${t.name} 선생님께 관리자 권한을 드렸어요`)}
                  />
                  {removing === t.user_id ? (
                    <Button label="정말 해제" variant="ghost" disabled={busy} onPress={async () => (await run('admin_block_teacher', { p_user: t.user_id, p_block: true }, '선생님 계정에서 해제했어요'), setRemoving(null))} />
                  ) : (
                    <Button label="해제(공용 계정 등)" variant="ghost" onPress={() => setRemoving(t.user_id)} />
                  )}
                </>
              )}
            </View>
          )}
        </View>
      ))}
      {(list?.pending ?? []).length ? (
        <AppText variant="label" style={{ marginTop: space.sm }}>
          로그인 전 미리 지정
        </AppText>
      ) : null}
      {(list?.pending ?? []).map((t) => (
        <View key={t.email} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 }}>
          <AppText variant="body" style={{ flex: 1 }} numberOfLines={1}>
            {t.name} 선생님 · {t.email}
          </AppText>
          {t.admin ? <Badge label="관리자" tone="accent" /> : null}
          <Button label="취소" variant="ghost" disabled={busy} onPress={() => run('admin_remove_teacher', { p_email: t.email }, '미리 지정을 취소했어요')} />
        </View>
      ))}
      <AppText variant="label" style={{ marginTop: space.sm }}>
        로그인 전에 관리자 권한 미리 드리기
      </AppText>
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
      <Button label={busy ? '…' : '미리 지정하기'} disabled={!ready || busy} onPress={async () => {
        if (await run('admin_add_teacher', { p_email: email.trim().toLowerCase(), p_name: name.trim(), p_admin: admin }, `${name.trim()} 선생님을 미리 지정했어요. 학교 계정으로 로그인하시면 바로 적용돼요`)) {
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
