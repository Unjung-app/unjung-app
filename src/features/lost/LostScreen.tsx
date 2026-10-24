import { useCallback, useState } from 'react';
import { Image, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { shortLabel } from '@/lib/date';
import { useAuth } from '@/state/auth';
import { useWallet } from '@/state/wallet';
import { color, radius, space } from '@/theme/tokens';
import { useLostFeed, type LostItem } from './data';

/** 분실물 게시판: 주웠어요 / 잃어버렸어요 / 내 글 */
export function LostScreen({ inStack = false }: { inStack?: boolean }) {
  const router = useRouter();
  const { status } = useAuth();
  const { refresh } = useWallet();
  const ready = status === 'ready' || status === 'needsEnrollment';
  const feed = useLostFeed(ready);
  const [tab, setTab] = useState<'found' | 'lost' | 'mine'>('found');

  useFocusEffect(
    useCallback(() => {
      feed.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [feed.reload]),
  );

  if (!ready) {
    return (
      <Screen topInset={!inStack}>
        {!inStack ? (
          <AppText variant="title" accessibilityRole="header">
            분실물
          </AppText>
        ) : null}
        <Card tone="navy">
          <AppText variant="heading" color={color.onNavy} style={{ fontSize: 20, lineHeight: 28 }}>
            학교 계정으로 로그인하면{'\n'}분실물을 찾고 올릴 수 있어요
          </AppText>
          <Button label="로그인하기" variant="soft" style={{ backgroundColor: color.surface }} onPress={() => router.push('/login')} />
        </Card>
      </Screen>
    );
  }

  const all = feed.items ?? [];
  const list = tab === 'mine' ? all.filter((x) => x.mine || x.i_responded) : all.filter((x) => x.type === tab);

  return (
    <Screen topInset={!inStack} onRefresh={feed.reload}>
      {!inStack ? (
        <AppText variant="title" accessibilityRole="header">
          분실물
        </AppText>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button label="📦 주웠어요" style={{ flex: 1 }} onPress={() => router.push('/lost/new?type=found')} />
        <Button label="🔍 잃어버렸어요" variant="soft" style={{ flex: 1 }} onPress={() => router.push('/lost/new?type=lost')} />
      </View>
      <AppText variant="caption" color={color.inkMuted} align="center">
        주인을 찾아 주면 +20 토큰 · 연락처 대신 학생회실 같은 전달 장소로 주고받아요
      </AppText>
      <Segmented
        label="보기"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'found', label: `주운 물건 ${all.filter((x) => x.type === 'found' && x.status === 'open').length}` },
          { value: 'lost', label: `찾는 물건 ${all.filter((x) => x.type === 'lost' && x.status === 'open').length}` },
          { value: 'mine', label: '내 글' },
        ]}
      />
      {feed.items === null ? (
        <AppText variant="body" color={color.inkMuted}>
          불러오는 중…
        </AppText>
      ) : list.length === 0 ? (
        <Card>
          <AppText variant="body" color={color.inkMuted}>
            {tab === 'found' ? '최근 30일 동안 올라온 주운 물건이 없어요.' : tab === 'lost' ? '찾는 물건이 없어요.' : '내가 올리거나 응답한 글이 없어요.'}
          </AppText>
        </Card>
      ) : (
        list.map((x) => (
          <LostCard
            key={x.id}
            x={x}
            onRespond={(on) => feed.respond(x.id, on)}
            onResolve={async () => {
              const r = await feed.resolve(x.id);
              if (r.ok) refresh();
              return r;
            }}
            onClose={() => feed.close(x.id)}
          />
        ))
      )}
    </Screen>
  );
}

function LostCard({
  x,
  onRespond,
  onResolve,
  onClose,
}: {
  x: LostItem;
  onRespond: (on: boolean) => Promise<{ ok: boolean; message?: string }>;
  onResolve: () => Promise<{ ok: boolean; message?: string }>;
  onClose: () => Promise<{ ok: boolean; message?: string }>;
}) {
  const [err, setErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setErr(null);
    const r = await fn();
    if (!r.ok) setErr(r.message ?? '실패했어요');
  };
  const found = x.type === 'found';
  const resolved = x.status === 'resolved';

  return (
    <Card style={{ gap: space.sm, opacity: resolved ? 0.7 : 1 }}>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        {x.photoUrl ? (
          <Image source={{ uri: x.photoUrl }} style={{ width: 84, height: 84, borderRadius: radius.control, backgroundColor: color.surfaceMuted }} accessibilityLabel={`${x.item} 사진`} />
        ) : (
          <View style={{ width: 84, height: 84, borderRadius: radius.control, backgroundColor: color.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
            <AppText style={{ fontSize: 30, lineHeight: 36 }}>{found ? '📦' : '🔍'}</AppText>
          </View>
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge label={found ? '주웠어요' : '잃어버렸어요'} tone={found ? 'success' : 'accent'} />
            {resolved ? <Badge label="✓ 해결됨" tone="muted" /> : x.has_response ? <Badge label="응답 있음" /> : null}
          </View>
          <AppText variant="heading">{x.item}</AppText>
          <AppText variant="caption" color={color.inkMuted}>
            {x.place} · {shortLabel(x.happened_on)}
          </AppText>
        </View>
      </View>
      {x.description ? <AppText variant="body">{x.description}</AppText> : null}
      {found && x.keep_at ? (
        <AppText variant="label" color={color.navy}>
          📍 {x.keep_at === '내가 보관 중' ? '주운 학생이 보관 중이에요' : `${x.keep_at}에 맡겨 뒀어요`}
        </AppText>
      ) : null}
      {x.mine && x.my_photo_status === 'pending' ? (
        <AppText variant="caption" color={color.accentInk}>
          사진은 검토위원 승인 뒤 다른 학생에게 보여요
        </AppText>
      ) : null}
      {x.mine && x.my_photo_status === 'rejected' ? (
        <AppText variant="caption" color={color.danger}>
          사진이 승인되지 않아 글만 보여요
        </AppText>
      ) : null}

      {!resolved ? (
        x.mine ? (
          <View style={{ gap: space.sm }}>
            {!found && x.has_response ? (
              <>
                <AppText variant="caption" color={color.success}>
                  누군가 찾았다고 했어요! 학생회실을 확인하거나 전해 받은 뒤 눌러 주세요.
                </AppText>
                <Button label="받았어요 (찾아 준 학생 +20)" onPress={() => run(onResolve)} />
              </>
            ) : found && x.has_response ? (
              <AppText variant="caption" color={color.success}>
                주인이 나타났어요! 주인이 '받았어요'를 누르면 +20 토큰을 받아요.
              </AppText>
            ) : null}
            <Button label="글 닫기" variant="ghost" onPress={() => run(onClose)} />
          </View>
        ) : x.i_responded ? (
          <View style={{ gap: space.sm }}>
            <AppText variant="caption" color={color.navy}>
              {found
                ? `${x.keep_at && x.keep_at !== '내가 보관 중' ? `${x.keep_at}에서` : '주운 학생에게서'} 물건을 받은 뒤 '받았어요'를 눌러 주세요.`
                : '물건을 학생회실에 맡기거나 직접 전해 주세요. 주인이 받으면 +20 토큰을 받아요.'}
            </AppText>
            {found ? <Button label="받았어요" onPress={() => run(onResolve)} /> : null}
            <Button label="응답 취소" variant="ghost" onPress={() => run(() => onRespond(false))} />
          </View>
        ) : !x.has_response ? (
          <Button label={found ? '🙋 제 거예요' : '🙌 제가 찾았어요'} variant="soft" onPress={() => run(() => onRespond(true))} />
        ) : null
      ) : null}
      {err ? (
        <AppText variant="label" weight="regular" color={color.danger}>
          {err}
        </AppText>
      ) : null}
    </Card>
  );
}
