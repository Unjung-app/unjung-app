// 웹 푸시 발송: Supabase의 push_outbox에 쌓인 알림을 가져가 각 기기로 보낸다.
//  · 누가 불러도 '쌓여 있는 것'만 보내므로 안전하다(DB의 pg_net이 쌓일 때마다, pg_cron이 10분마다 부른다).
//  · 수업 중인 학생의 알림은 DB가 내주지 않는다(쉬는 시간·방과 후에 다시 부를 때 나간다).
// 필요한 환경변수: SUPABASE_SECRET_KEY, VAPID_PRIVATE_KEY (둘 다 서버 전용)
import webpush from 'web-push';
import { VAPID_PUBLIC_KEY } from '../../src/lib/pushKey';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uikvrgjqcktzcshvaxdj.supabase.co';
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

type Sub = { endpoint: string; p256dh: string; auth: string };
type Item = { id: number; title: string; body: string; url: string; tag: string; subs: Sub[] };

async function rpc<T>(key: string, fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`${fn} ${res.status} ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

async function handle() {
  const key = process.env.SUPABASE_SECRET_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!key || !priv) return json(503, { error: 'SUPABASE_SECRET_KEY 또는 VAPID_PRIVATE_KEY 환경변수가 없어요' });
  webpush.setVapidDetails('mailto:howonlee728@gmail.com', VAPID_PUBLIC_KEY, priv);

  const started = Date.now();
  let sent = 0;
  let gone = 0;
  let failed = 0;
  // 한 번에 100개씩, 최대 40초 동안 비울 때까지
  while (Date.now() - started < 40_000) {
    const items = await rpc<Item[]>(key, 'push_take_batch', { p_limit: 100 });
    if (!items?.length) break;
    const done: number[] = [];
    const ok = new Set<string>();
    const dead = new Set<string>();
    await Promise.all(
      items.map(async (it) => {
        const payload = JSON.stringify({ title: it.title, body: it.body, url: it.url, tag: it.tag });
        const results = await Promise.all(
          it.subs.map((s) =>
            webpush
              .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 6 * 3600, urgency: 'normal' })
              .then(() => (ok.add(s.endpoint), 'ok' as const))
              .catch((e: { statusCode?: number }) => {
                if (e?.statusCode === 404 || e?.statusCode === 410) {
                  dead.add(s.endpoint);
                  return 'gone' as const;
                }
                return 'fail' as const;
              }),
          ),
        );
        // 한 기기라도 받았거나, 남은 기기가 모두 없어졌으면 끝난 것으로 본다(실패만 있으면 다음에 다시)
        if (results.some((r) => r === 'ok') || results.every((r) => r === 'gone')) done.push(it.id);
        else failed++;
      }),
    );
    sent += ok.size;
    gone += dead.size;
    await rpc(key, 'push_report', { p_sent: done, p_ok_endpoints: [...ok], p_gone_endpoints: [...dead] });
    if (items.length < 100) break;
  }
  return json(200, { sent, gone, failed });
}

export async function POST() {
  try {
    return await handle();
  } catch (e) {
    return json(500, { error: String((e as Error).message ?? e).slice(0, 300) });
  }
}

export const GET = POST;
